/** Типы поиска, общие для сервера (индекс) и клиента (интерфейс). Без серверных зависимостей. */

export type SearchKind = "section" | "rule" | "job" | "vehicle" | "business" | "realty" | "place" | "term";

export const searchKindLabels: Record<SearchKind, string> = {
  section: "Разделы",
  rule: "Правила",
  job: "Работы",
  vehicle: "Транспорт",
  business: "Бизнесы",
  realty: "Недвижимость",
  place: "Карта",
  term: "RP термины",
};

/** Порядок групп в выдаче */
export const searchKindOrder: SearchKind[] = [
  "section",
  "rule",
  "job",
  "vehicle",
  "business",
  "realty",
  "place",
  "term",
];

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  /** Короткая строка под заголовком: категория, цена, номер пункта */
  subtitle?: string;
  /** Фрагмент текста вокруг найденного слова */
  snippet?: string;
  href: string;
  external?: boolean;
};

export type SearchGroup = {
  kind: SearchKind;
  label: string;
  /** Сколько всего нашлось (в hits может быть меньше из-за лимита) */
  total: number;
  hits: SearchHit[];
};

export type SearchResponse = {
  query: string;
  total: number;
  groups: SearchGroup[];
};

export const MIN_QUERY_LENGTH = 2;
