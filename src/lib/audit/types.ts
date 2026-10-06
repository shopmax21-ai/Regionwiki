import type { Person } from "@/lib/auth/person";

/**
 * Журнал «Аудит действий администрации»: только значимые изменения (доступ, роли и права, правки и удаление контента,
 * решения по наказаниям, правка чужих мероприятий). Просмотры, копирование, прохождение тестов и мелкие переключатели
 * не записываются. Файл без серверного кода: его можно импортировать и в клиентских компонентах.
 */

export const AUDIT_CATEGORIES = ["access", "roles", "content", "punishments", "academy", "calendar"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  access: "Доступ",
  roles: "Роли и права",
  content: "Контент",
  punishments: "Наказания",
  academy: "Академия",
  calendar: "Календарь",
};

/** critical: меняется состав или права администрации; important: удаление и решения по доступу; normal: остальные правки */
export const AUDIT_SEVERITIES = ["critical", "important", "normal"] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  critical: "Критичное",
  important: "Важное",
  normal: "Обычное",
};

export const isAuditCategory = (value: unknown): value is AuditCategory =>
  typeof value === "string" && (AUDIT_CATEGORIES as readonly string[]).includes(value);

export const isAuditSeverity = (value: unknown): value is AuditSeverity =>
  typeof value === "string" && (AUDIT_SEVERITIES as readonly string[]).includes(value);

export type AuditEntry = {
  id: string;
  at: string;
  /** Кто сделал: актуальные Никнейм, Statik ID и роль (запасной вариант: сохранённое имя) */
  actor: Person;
  category: AuditCategory;
  /** Код действия, например «item.deleted» */
  action: string;
  severity: AuditSeverity;
  targetType: string;
  targetId: string;
  targetLabel: string;
  /** Готовая фраза: «Удалён предмет «Аптечка»» */
  summary: string;
  /** Подробности «название: значение» (было и стало, владелец и т.п.) */
  details: Record<string, string>;
};

/** Сущности, правки которых попадают в журнал. fem: женский род для фраз «Добавлена метка». */
export const AUDIT_ENTITIES = {
  item: { noun: "предмет", fem: false, category: "content" },
  vehicle: { noun: "транспорт", fem: false, category: "content" },
  business: { noun: "бизнес", fem: false, category: "content" },
  realty: { noun: "объект недвижимости", fem: false, category: "content" },
  place: { noun: "метка на карте", fem: true, category: "content" },
  job: { noun: "работа", fem: true, category: "content" },
  reply: { noun: "быстрый ответ", fem: false, category: "content" },
  test: { noun: "тест", fem: false, category: "academy" },
} as const satisfies Record<string, { noun: string; fem: boolean; category: AuditCategory }>;

export type AuditEntity = keyof typeof AUDIT_ENTITIES;
export type AuditVerb = "created" | "updated" | "deleted";

const VERB_WORDS: Record<AuditVerb, [string, string]> = {
  created: ["Добавлен", "Добавлена"],
  updated: ["Изменён", "Изменена"],
  deleted: ["Удалён", "Удалена"],
};

/** «Удалён предмет «Аптечка»», «Добавлена метка на карте «Банк»» */
export function contentSummary(entity: AuditEntity, verb: AuditVerb, label: string): string {
  const { noun, fem } = AUDIT_ENTITIES[entity];
  return `${VERB_WORDS[verb][fem ? 1 : 0]} ${noun} «${label}»`;
}

export const PAGE_SIZE = 40;
