import type { Person } from "@/lib/auth/person";

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

/** Цвета мероприятий в календаре. Первый — цвет по умолчанию. Свой оттенок тоже можно выбрать (любой #RRGGBB). */
export const EVENT_COLORS = [
  { value: "#3b82f6", label: "Синий" },
  { value: "#6366f1", label: "Индиго" },
  { value: "#8b5cf6", label: "Фиолетовый" },
  { value: "#ec4899", label: "Розовый" },
  { value: "#ef4444", label: "Красный" },
  { value: "#f97316", label: "Оранжевый" },
  { value: "#eab308", label: "Жёлтый" },
  { value: "#22c55e", label: "Зелёный" },
  { value: "#14b8a6", label: "Бирюзовый" },
  { value: "#64748b", label: "Серый" },
] as const;

export const DEFAULT_EVENT_COLOR: string = EVENT_COLORS[0].value;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const isEventColor = (value: unknown): value is string => typeof value === "string" && HEX_COLOR.test(value);

/** Цвет текста на плашке мероприятия: чёрный на светлых цветах и белый на тёмных (по яркости цвета). */
export function readableTextOn(hex: string): string {
  if (!isEventColor(hex)) return "#ffffff";
  const channel = (start: number) => Number.parseInt(hex.slice(start, start + 2), 16);
  const luminance = (0.299 * channel(1) + 0.587 * channel(3) + 0.114 * channel(5)) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}

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
  /** Организатор для отображения: актуальные Никнейм, Statik ID и роль (запасной вариант: сохранённое имя) */
  owner: Person;
  /** Цвет мероприятия в календаре (#RRGGBB) */
  color: string;
  /** Напоминание в Telegram за час до начала (получает ownerId) */
  notify: boolean;
  /** Напоминание уже отправлено */
  reminded: boolean;
};

/** Два промежутка пересекаются, если каждый начинается раньше, чем заканчивается другой (стык не считается). */
export const overlaps = (a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }): boolean =>
  new Date(a.startsAt).getTime() < new Date(b.endsAt).getTime() &&
  new Date(b.startsAt).getTime() < new Date(a.endsAt).getTime();

export type ConflictInfo = Pick<CalendarEvent, "id" | "title" | "startsAt" | "endsAt" | "ownerName" | "owner">;
