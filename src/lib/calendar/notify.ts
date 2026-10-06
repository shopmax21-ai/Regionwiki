import { getAuthConfig } from "@/lib/auth/config";
import { listCalendarSubscribers } from "@/lib/auth/db";
import { sendMessage } from "@/lib/auth/telegram";

import { type CalendarEvent, MSK_ZONE } from "./types";

/**
 * Сообщения в Telegram тем, кто включил «Следить за календарём»: о новых, изменённых и удалённых мероприятиях.
 * Тот, кто сам внёс изменение, сообщение о нём не получает. Сбой отправки никого не задерживает и ничего не ломает.
 */

const dayTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: MSK_ZONE,
});
const timeOnly = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: MSK_ZONE });
const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: MSK_ZONE });

export const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Span = Pick<CalendarEvent, "startsAt" | "endsAt">;

/** «5 октября, 14:00–15:30 (МСК)» или «5 октября, 22:00 — 6 октября, 02:00 (МСК)» */
export function spanText({ startsAt, endsAt }: Span): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (dateKey.format(start) === dateKey.format(end)) {
    return `${dayTime.format(start)}–${timeOnly.format(end)} (МСК)`;
  }
  return `${dayTime.format(start)} — ${dayTime.format(end)} (МСК)`;
}

export type CalendarChange =
  | { kind: "created"; event: CalendarEvent }
  | { kind: "updated"; before: CalendarEvent; after: CalendarEvent }
  | { kind: "deleted"; event: CalendarEvent };

/** Что поменялось в мероприятии (пусто, если изменился только цвет или заметка). */
export function describeChanges(before: CalendarEvent, after: CalendarEvent): string[] {
  const lines: string[] = [];
  if (before.title !== after.title) {
    lines.push(`Название: ${escapeHtml(before.title)} → ${escapeHtml(after.title)}`);
  }
  if (before.startsAt !== after.startsAt || before.endsAt !== after.endsAt) {
    lines.push(`Время: ${spanText(before)} → ${spanText(after)}`);
  }
  if (before.location !== after.location) {
    lines.push(
      `Место: ${before.location ? escapeHtml(before.location) : "не указано"} → ${after.location ? escapeHtml(after.location) : "не указано"}`,
    );
  }
  return lines;
}

function messageFor(change: CalendarChange, actor: string): string | null {
  if (change.kind === "created") {
    const { event } = change;
    const lines = [
      "🆕 <b>Новое мероприятие в календаре</b>",
      "",
      `<b>${escapeHtml(event.title)}</b>`,
      `🕒 ${spanText(event)}`,
    ];
    if (event.location) lines.push(`📍 ${escapeHtml(event.location)}`);
    lines.push(`👤 Зарегистрировал: ${escapeHtml(actor)}`);
    return lines.join("\n");
  }

  if (change.kind === "updated") {
    const changes = describeChanges(change.before, change.after);
    // Правка цвета или заметки подписчикам не интересна
    if (changes.length === 0) return null;
    return [
      "✏️ <b>Мероприятие изменено</b>",
      "",
      `<b>${escapeHtml(change.after.title)}</b>`,
      ...changes,
      `👤 Изменил: ${escapeHtml(actor)}`,
    ].join("\n");
  }

  const { event } = change;
  return [
    "🗑 <b>Мероприятие удалено</b>",
    "",
    `<b>${escapeHtml(event.title)}</b>`,
    `🕒 ${spanText(event)}`,
    `👤 Удалил: ${escapeHtml(actor)}`,
  ].join("\n");
}

/** Рассылает сообщение подписчикам. Возвращает, скольким ушло. Никогда не бросает ошибку. */
export async function notifyCalendarSubscribers(
  change: CalendarChange,
  actor: { id: string; label: string },
): Promise<number> {
  try {
    const config = getAuthConfig();
    if (!config) return 0;
    const text = messageFor(change, actor.label);
    if (!text) return 0;

    const subscribers = (await listCalendarSubscribers()).filter((user) => user.telegramId !== actor.id);
    const results = await Promise.allSettled(subscribers.map((user) => sendMessage(config, user.telegramId, text)));
    return results.filter((result) => result.status === "fulfilled" && result.value).length;
  } catch (error) {
    console.error("[calendar] Не удалось оповестить подписчиков", error);
    return 0;
  }
}
