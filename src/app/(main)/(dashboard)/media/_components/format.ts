const numberFormat = new Intl.NumberFormat("ru-RU");

/** 12345 → «12 345» */
export const formatViewers = (value: number) => numberFormat.format(value);

/** Сколько идёт эфир к моменту проверки: «35 мин», «2 ч 15 мин». Считается от времени сервера, а не от часов браузера. */
export function formatUptime(startedAt: string, nowIso: string | null): string | null {
  if (!nowIso) return null;
  const minutes = Math.floor((Date.parse(nowIso) - Date.parse(startedAt)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 60) return `${Math.max(minutes, 1)} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

/** Две первые буквы имени для заглушки вместо аватарки. */
export const initials = (name: string) =>
  Array.from(name.replace(/[^\p{L}\p{N}]/gu, ""))
    .slice(0, 2)
    .join("")
    .toUpperCase();
