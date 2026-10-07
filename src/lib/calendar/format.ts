import { MSK_OFFSET, MSK_ZONE } from "./types";

const dayTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: MSK_ZONE,
});
const timeOnly = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: MSK_ZONE });
const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: MSK_ZONE });

const sameDay = (a: string, b: string) => dateKey.format(new Date(a)) === dateKey.format(new Date(b));

/** «5 окт., 14:00 – 15:30» в один день и «5 окт., 22:00 – 6 окт., 02:00» на стыке дней (московское время) */
export function formatRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return sameDay(startsAt, endsAt)
    ? `${dayTime.format(start)} – ${timeOnly.format(end)}`
    : `${dayTime.format(start)} – ${dayTime.format(end)}`;
}

/** Для поля datetime-local: московское время в виде «2026-10-05T14:00» */
export const toInputValue = (iso: string): string =>
  new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 16);

/** Из поля datetime-local (московское время) в момент времени; пустое или битое значение даёт null */
export function fromInputValue(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${MSK_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Ближайший круглый час после now, в виде момента времени */
export function nextFullHour(now: number): string {
  return new Date(Math.ceil((now + 1) / 3_600_000) * 3_600_000).toISOString();
}

/** «через 40 мин», «через 3 ч», «через 2 дн.» или «5 мин назад» — для подписей в списке */
export function relativeTo(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const minutes = Math.max(1, Math.round(abs / 60_000));
  let text: string;
  if (minutes < 60) text = `${minutes} мин`;
  else if (minutes < 60 * 24) text = `${Math.round(minutes / 60)} ч`;
  else text = `${Math.round(minutes / (60 * 24))} дн.`;
  return diff >= 0 ? `через ${text}` : `${text} назад`;
}
