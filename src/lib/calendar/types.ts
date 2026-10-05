/** Общие типы календаря мероприятий. Файл без серверного кода: его можно импортировать и в клиентских компонентах. */

/** Время в проекте везде московское (GMT+3, без перехода на летнее), поэтому поля формы читаются как московское время. */
export const MSK_OFFSET = "+03:00";
export const MSK_ZONE = "Europe/Moscow";

export const EVENT_LIMITS = {
  title: 120,
  description: 1000,
  location: 120,
  /** Мероприятие не может длиться дольше недели: защита от случайной опечатки в дате */
  maxDurationHours: 24 * 7,
} as const;

/** За сколько до начала приходит напоминание в Telegram */
export const REMINDER_LEAD_MINUTES = 60;

export type EventStatus = "upcoming" | "live" | "finished";

export const STATUS_LABELS: Record<EventStatus, string> = {
  upcoming: "Ожидается",
  live: "Идёт",
  finished: "Закончилось",
};

/** Статус считается по времени, а не хранится: он всегда точен и сам меняется без участия администратора. */
export function statusOf(event: { startsAt: string; endsAt: string }, now: number = Date.now()): EventStatus {
  if (now < new Date(event.startsAt).getTime()) return "upcoming";
  if (now < new Date(event.endsAt).getTime()) return "live";
  return "finished";
}

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  /** Telegram ID того, кто зарегистрировал мероприятие */
  ownerId: string;
  ownerName: string;
  /** Напоминание в Telegram за час до начала (получает ownerId) */
  notify: boolean;
  /** Напоминание уже отправлено */
  reminded: boolean;
};

/** Два промежутка пересекаются, если каждый начинается раньше, чем заканчивается другой (стык не считается). */
export const overlaps = (a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }): boolean =>
  new Date(a.startsAt).getTime() < new Date(b.endsAt).getTime() &&
  new Date(b.startsAt).getTime() < new Date(a.endsAt).getTime();

export type ConflictInfo = Pick<CalendarEvent, "id" | "title" | "startsAt" | "endsAt" | "ownerName">;
