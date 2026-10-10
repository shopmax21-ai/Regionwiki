import { getAuthConfig } from "@/lib/auth/config";
import { listMediaSubscribers } from "@/lib/auth/db";
import { sendMessage } from "@/lib/auth/telegram";

import { claimStreamNotification, listNotifyChannels, releaseStreamNotification } from "./channels";
import { fetchStreamsByLogins, isTwitchConfigured } from "./twitch";

/**
 * Оповещения о начале трансляций. Раз в минуту проверяем каналы из списка с включённым оповещением и, когда
 * эфир только начался, пишем в Telegram администраторам, которые включили оповещения на странице «Медиа».
 * Каждая трансляция оповещается один раз. Эфир, начатый давно (например, до добавления канала или до
 * перезапуска сайта), не оповещается: сообщение «начал трансляцию» через три часа вводило бы в заблуждение.
 */

const CHECK_INTERVAL_MS = 60_000;
/** Эфир старше этого срока считается уже идущим, а не только что начатым */
const FRESH_MS = 15 * 60_000;

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function streamStartedText(stream: {
  name: string;
  login: string;
  title: string;
  game: string;
  viewers: number;
}): string {
  const lines = [`🔴 <b>${escapeHtml(stream.name)}</b> начал трансляцию`];
  if (stream.title.trim()) lines.push("", escapeHtml(stream.title.trim()));
  if (stream.game) lines.push(`🎮 ${escapeHtml(stream.game)}`);
  lines.push(`🔗 https://www.twitch.tv/${encodeURIComponent(stream.login)}`);
  lines.push("", "Отключить оповещения можно в разделе «Медиа» на сайте.");
  return lines.join("\n");
}

/** Одна проверка. Возвращает, сколько сообщений ушло. */
export async function checkStreamStarts(): Promise<number> {
  const config = getAuthConfig();
  if (!config || !isTwitchConfigured()) return 0;

  const channels = await listNotifyChannels();
  if (channels.length === 0) return 0;

  const subscribers = await listMediaSubscribers();
  if (subscribers.length === 0) return 0;

  const now = Date.now();
  const live = await fetchStreamsByLogins(channels.map((channel) => channel.login));
  let sent = 0;

  for (const stream of live) {
    if (now - Date.parse(stream.started_at) > FRESH_MS) continue;
    const login = stream.user_login.toLowerCase();
    if (!(await claimStreamNotification(login, stream.id))) continue;

    const text = streamStartedText({
      name: stream.user_name || stream.user_login,
      login: stream.user_login,
      title: stream.title,
      game: stream.game_name,
      viewers: stream.viewer_count,
    });
    const results = await Promise.allSettled(subscribers.map((user) => sendMessage(config, user.telegramId, text)));
    const delivered = results.filter((result) => result.status === "fulfilled" && result.value).length;
    if (delivered === 0) await releaseStreamNotification(login, stream.id).catch(() => undefined);
    sent += delivered;
  }
  return sent;
}

/** Запускает проверку раз в минуту внутри процесса сайта (нужен постоянно работающий сервер, как и для напоминаний). */
export function startMediaWatcher(): void {
  const globalState = globalThis as unknown as { __mediaWatcherStarted?: boolean };
  if (globalState.__mediaWatcherStarted) return;
  globalState.__mediaWatcherStarted = true;

  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    checkStreamStarts()
      .then((sent) => {
        if (sent > 0) console.info(`[media] Отправлено оповещений о трансляциях: ${sent}`);
      })
      .catch((error) =>
        console.error("[media] Сбой проверки трансляций", error instanceof Error ? error.message : error),
      )
      .finally(() => {
        running = false;
      });
  };
  setTimeout(tick, 20_000).unref?.();
  setInterval(tick, CHECK_INTERVAL_MS).unref?.();
}
