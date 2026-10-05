/** Время в проекте везде московское (GMT+3), поэтому и результаты показываем в нём: сервер и браузер выдают одно и то же. */
const dateTime = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** «4 мин 12 с» по двум отметкам времени */
export function formatSpent(startedAt: string, finishedAt: string): string {
  const seconds = Math.max(0, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} с`;
  return rest === 0 ? `${minutes} мин` : `${minutes} мин ${rest} с`;
}

/** «1 вопрос», «3 вопроса», «5 вопросов» */
export function pluralize(count: number, forms: readonly [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
