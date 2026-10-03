/** Разбор запроса, общий для сервера (поиск) и клиента (подсветка). Без зависимостей. */

export const normalizeText = (value: string) => value.toLowerCase().replaceAll("ё", "е");

const CYRILLIC = /^[а-яё]+$/i;

/**
 * Грубое отсечение окончания, чтобы «ограбление» находило «ограбления» и «ограблений»,
 * а «заправка» — «заправки». Только для русских слов; числа и латиница остаются как есть.
 */
export function searchStem(term: string): string {
  if (!CYRILLIC.test(term)) return term;
  if (term.length >= 7) return term.slice(0, -2);
  if (term.length >= 5) return term.slice(0, -1);
  return term;
}

/** Слова запроса: в нижнем регистре, без «ё», с отсечёнными окончаниями. */
export function toSearchTerms(query: string): string[] {
  return normalizeText(query.trim()).split(/\s+/).filter(Boolean).map(searchStem);
}
