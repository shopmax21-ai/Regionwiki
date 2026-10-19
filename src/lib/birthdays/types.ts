/**
 * Дни рождения: хранятся как «ММ-ДД» без года (год не нужен и лишний раз раскрывает возраст).
 * Файл без серверного кода: его можно импортировать и в клиентских компонентах.
 */

import type { Person } from "@/lib/auth/person";

const MSK_ZONE = "Europe/Moscow";

export const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

/** Сколько дней можно выбрать в месяце: в феврале 29, чтобы родившиеся 29 февраля тоже могли указать дату. */
export const MAX_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const pad = (value: number) => String(value).padStart(2, "0");

export const toBirthday = (month: number, day: number): string => `${pad(month)}-${pad(day)}`;

/** Разбирает «ММ-ДД»: null, если строка не похожа на существующую дату. */
export function parseBirthday(value: unknown): { month: number; day: number } | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > MAX_DAYS[month - 1]) return null;
  return { month, day };
}

/** «5 октября» */
export function formatBirthday(value: string): string {
  const parsed = parseBirthday(value);
  return parsed ? `${parsed.day} ${MONTHS[parsed.month - 1]}` : "";
}

export type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  /** «ГГГГ-ММ-ДД» */
  key: string;
  /** «ММ-ДД» */
  md: string;
};

const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: MSK_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** Дата и час по Москве: везде в проекте время московское, поэтому и день рождения наступает по Москве. */
export function mskDateParts(timestamp: number = Date.now()): DateParts {
  const values: Record<string, number> = {};
  for (const part of partsFormat.formatToParts(new Date(timestamp))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  const { year, month, day, hour } = values;
  return { year, month, day, hour, key: `${year}-${pad(month)}-${pad(day)}`, md: toBirthday(month, day) };
}

/** Какие значения «ММ-ДД» отмечаются в этот день: родившиеся 29 февраля в невисокосный год отмечают 28-го. */
export function birthdayKeysFor(date: Pick<DateParts, "year" | "md">): string[] {
  return date.md === "02-28" && !isLeapYear(date.year) ? ["02-28", "02-29"] : [date.md];
}

/** Дата дня рождения в указанном году («ГГГГ-ММ-ДД») с учётом 29 февраля. */
export function birthdayInYear(value: string, year: number): string | null {
  const parsed = parseBirthday(value);
  if (!parsed) return null;
  const day = parsed.month === 2 && parsed.day === 29 && !isLeapYear(year) ? 28 : parsed.day;
  return `${year}-${pad(parsed.month)}-${pad(day)}`;
}

/** Именинник в календаре: актуальные Никнейм и Static ID уже собраны в подпись. */
export type CalendarBirthday = {
  id: string;
  label: string;
  /** Для плашки над календарём: Никнейм, роль и Static ID показываются так же, как везде на сайте */
  person: Person;
  /** «ММ-ДД» */
  birthday: string;
};
