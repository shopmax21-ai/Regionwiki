const MSK = "Europe/Moscow";
const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: MSK,
});
const full = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: MSK });

/** «05.10, 14:30» по Москве: время в проекте московское, как в Telegram и календаре. */
export const formatShort = (iso: string) => dateTime.format(new Date(iso));
export const formatFull = (iso: string) => full.format(new Date(iso));

/** «5 мин назад», «2 ч назад», «3 дн. назад» для подписи «как давно подана заявка» */
export function ago(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} ч назад`;
  return `${Math.round(minutes / (60 * 24))} дн. назад`;
}

export const minutesText = (minutes: number) => {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${minutes} мин (${h} ч)` : `${minutes} мин (${h} ч ${m} мин)`;
};
