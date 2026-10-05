import { getAuthConfig } from "@/lib/auth/config";
import { sendMessage } from "@/lib/auth/telegram";

import { claimDueReminders, type DueReminder, releaseReminder } from "./store";
import { MSK_ZONE } from "./types";

/** Раз в сколько проверяем, не пора ли напомнить. Напоминание приходит с точностью до этой минуты. */
const CHECK_INTERVAL_MS = 60_000;

const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: MSK_ZONE });

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** «через 58 мин» или «через час» */
function leadText(startsAt: string, now: number): string {
  const minutes = Math.max(1, Math.round((new Date(startsAt).getTime() - now) / 60_000));
  if (minutes >= 58) return "через час";
  const mod10 = minutes % 10;
  const mod100 = minutes % 100;
  let word = "минут";
  if (mod10 === 1 && mod100 !== 11) word = "минуту";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = "минуты";
  return `через ${minutes} ${word}`;
}

export function reminderText(event: DueReminder, now: number = Date.now()): string {
  const lines = [
    `⏰ <b>Мероприятие ${leadText(event.startsAt, now)}</b>`,
    "",
    `<b>${escapeHtml(event.title)}</b>`,
    `🕒 ${time.format(new Date(event.startsAt))}–${time.format(new Date(event.endsAt))} (МСК)`,
  ];
  if (event.location) lines.push(`📍 ${escapeHtml(event.location)}`);
  lines.push("", "Отключить напоминание можно в разделе «Календарь» на сайте.");
  return lines.join("\n");
}

/** Одна проверка: забирает созревшие напоминания и отправляет их авторам. Возвращает, сколько ушло. */
export async function sendDueReminders(): Promise<number> {
  const config = getAuthConfig();
  // Без бота слать некуда: напоминания остаются в очереди, пока настройка не появится
  if (!config) return 0;

  const due = await claimDueReminders();
  let sent = 0;
  for (const event of due) {
    const delivered = await sendMessage(config, event.ownerId, reminderText(event)).catch(() => false);
    if (delivered) sent++;
    else
      await releaseReminder(event.id).catch((error) =>
        console.error("[calendar] Не удалось вернуть напоминание", error),
      );
  }
  return sent;
}

/** Запускает проверку раз в минуту внутри процесса сайта (нужен постоянно работающий сервер, как и для правил). */
export function startCalendarReminders(): void {
  const globalState = globalThis as unknown as { __calendarRemindersStarted?: boolean };
  if (globalState.__calendarRemindersStarted) return;
  globalState.__calendarRemindersStarted = true;

  let running = false;
  const tick = () => {
    // Если прошлая проверка ещё не закончилась (медленная сеть), новую не запускаем
    if (running) return;
    running = true;
    sendDueReminders()
      .then((sent) => {
        if (sent > 0) console.info(`[calendar] Отправлено напоминаний: ${sent}`);
      })
      .catch((error) => console.error("[calendar] Сбой проверки напоминаний", error))
      .finally(() => {
        running = false;
      });
  };
  setTimeout(tick, 15_000).unref?.();
  setInterval(tick, CHECK_INTERVAL_MS).unref?.();
}
