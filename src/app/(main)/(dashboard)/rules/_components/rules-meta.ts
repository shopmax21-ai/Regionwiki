import type { RuleSectionData } from "../_content/parse";

/**
 * Клиент-безопасные данные о разделах правил (без самого текста правил).
 * Текст правил лежит в ../_content и подключается только на сервере через rules-content.ts.
 */

export type RuleGroup = "general" | "government";

export type RuleArticleMeta = {
  slug: string;
  group: RuleGroup;
  /** Краткий тег для наказаний, например «ОП». Если не задан, копируется только номер. */
  tag?: string;
  title: string;
  updatedAt: string;
  description: string;
};

export type RuleGroupMeta = {
  title: string;
  description: string;
  articles: RuleArticleMeta[];
};

export const ruleGroups: Record<RuleGroup, RuleGroupMeta> = {
  general: {
    title: "Основные правила",
    description: "Общие правила проекта, игровые ситуации и ответственность игроков.",
    articles: [
      {
        slug: "obshchiye-pravila",
        group: "general",
        tag: "ОП",
        title: "Общие правила",
        updatedAt: "21.09.2026",
        description: "Положения проекта, аккаунты, чаты, RolePlay-процесс, отыгровки, модерируемые платформы",
      },
      {
        slug: "pravila-postavok-i-perekhvata",
        group: "general",
        tag: "ПП",
        title: "Правила поставок и перехвата",
        updatedAt: "22.09.2026",
        description: "Порядок поставок и перехватов для государственных структур и нелегальных организаций",
      },
      {
        slug: "pravila-ograblenii-i-pokhishchenii",
        group: "general",
        tag: "ОГ",
        title: "Правила ограблений и похищений",
        updatedAt: "21.09.2026",
        description: "Похищения, ограбления, выкуп, правила жертвы и выкупающей стороны",
      },
      {
        slug: "pravila-semeinykh-organizatsii",
        group: "general",
        tag: "СО",
        title: "Правила семейных организаций",
        updatedAt: "21.09.2026",
        description: "Деятельность семей, дипломатия и санкции",
      },
      {
        slug: "pravila-voiny-za-vozdushnyi-gruz-vza",
        group: "general",
        tag: "ВЗА",
        title: "Правила Войны за Воздушный груз [ВЗА]",
        updatedAt: "21.09.2026",
        description: "Регулярное мероприятие: зоны, расписание, дресс-код и запреты",
      },
      {
        slug: "pravila-dlya-liderov-fraktsii",
        group: "general",
        tag: "ЛФ",
        title: "Правила для лидеров фракций",
        updatedAt: "29.05.2026",
        description: "Лидерский срок, обязанности лидеров и ограничения",
      },
      {
        slug: "pravila-i-obyazannosti-administratsii",
        group: "general",
        tag: "АД",
        title: "Правила и обязанности администрации",
        updatedAt: "24.05.2026",
        description: "Регламент работы администраторов, игровое имущество и обязанности куратора",
      },
      {
        slug: "pravila-napadeniya-na-voinskuyu-chast",
        group: "general",
        tag: "ВЧ",
        title: "Правила нападения на Воинскую Часть",
        updatedAt: "19.05.2026",
        description: "Порядок нападения, правила для Вооружённых Сил, госструктур и криминальных семей",
      },
      {
        slug: "pravila-ob-igrovom-imushchestve",
        group: "general",
        tag: "ИМ",
        title: "Правила об игровом имуществе",
        updatedAt: "27.04.2026",
        description: "Покупка и продажа имущества, бизнесы, дома, мошенничество и монополии",
      },
      {
        slug: "pravila-igrovykh-zon",
        group: "general",
        tag: "ЗОН",
        title: "Правила игровых зон",
        updatedAt: "04.04.2026",
        description: "Зелёная, красная, серая и голубая зоны",
      },
      {
        slug: "pravila-proverki-na-storonneye-po",
        group: "general",
        tag: "ПО",
        title: "Правила проверки на стороннее ПО",
        updatedAt: "05.03.2026",
        description: "Как проводится проверка, права игрока и обязанности администратора",
      },
      {
        slug: "pravila-foruma",
        group: "general",
        tag: "ФО",
        title: "Правила форума",
        updatedAt: "08.12.2025",
        description: "Аккаунт, общение и создание тем на форуме",
      },
    ],
  },
  government: {
    title: "Правила государственных структур",
    description: "Порядок работы государственных организаций и фракционной игры.",
    articles: [
      {
        slug: "pravila-gosudarstvennykh-organizatsii",
        group: "government",
        tag: "ПГО",
        title: "Правила государственных организаций",
        updatedAt: "24.02.2026",
        description:
          "Общие положения, кадры, Правительство, Вооружённые силы, МВД / ГИБДД, ЦГБ, СМИ, новости, суд и прокуратура",
      },
    ],
  },
};

export function articleHref(group: RuleGroup, slug: string): string {
  return `/rules/${group}/${slug}`;
}

export type RuleArticleView = RuleArticleMeta & {
  ruleCount: number;
  sections: RuleSectionData[];
  status: RuleArticleStatus;
};

/** Краткая запись пункта для поиска по всей группе правил. */
export type RuleSearchEntry = {
  group: RuleGroup;
  slug: string;
  articleTitle: string;
  sectionTitle: string;
  tag?: string;
  number: string;
  anchor: string;
  text: string;
  punishments: string[];
  /** Всё остальное: списки, примечания, пояснения, примеры, исключения */
  extra: string;
};

export type RuleArticleCard = RuleArticleMeta & { ruleCount: number; status: RuleArticleStatus };

export type RuleChangeType = "added" | "changed" | "removed";

export type RuleChange = {
  type: RuleChangeType;
  /** Номер пункта, например «1.3» */
  number: string;
  /** Текст до изменения (для «changed» и «removed») */
  before?: string;
  /** Текст после изменения (для «changed» и «added») */
  after?: string;
};

export type ChangelogEntry = {
  date: string;
  title: string;
  section: string;
  group: RuleGroup;
  slug: string;
  /** Что именно изменилось. Если не указано, в ленте показывается только ссылка на правила. */
  changes?: RuleChange[];
};

/**
 * Записи до включения автообновления (вручную). Новые изменения пишет фоновая проверка в базу
 * (таблица rule_changes) и показывает выше этих записей. Поля changes ниже — примерные данные для демонстрации,
 * при желании их можно удалить.
 */
export const changelog: ChangelogEntry[] = [
  {
    date: "22.09.2026",
    title: "Правила поставок и перехвата",
    section: "Основные правила",
    group: "general",
    slug: "pravila-postavok-i-perekhvata",
    changes: [
      {
        type: "changed",
        number: "1.3",
        before: "Поставки и перехваты могут осуществляться с 12:00 до 22:00. | Demorgan 30 - 60 минут всем участникам.",
        after:
          "Поставки и перехваты могут осуществляться с 12:00 до 23:00. | Demorgan 30 - 60 минут всем участникам + Устный / Строгий выговор лидеру.",
      },
      {
        type: "changed",
        number: "1.4",
        before:
          "Запрещено поджидать организации на точке загрузки, а также менее 500 метров от неё. | Demorgan 100 минут.",
        after:
          "Запрещено поджидать организации на точке загрузки, а также менее 550 метров от неё. | Demorgan 100 минут.",
      },
      {
        type: "added",
        number: "1.10",
        after: "Запрещено намеренно отдавать преимущество и поставки. | Выговор лидеру / Снятие лидера.",
      },
      {
        type: "removed",
        number: "1.9",
        before: "Пункт утратил силу.",
      },
    ],
  },
  {
    date: "21.09.2026",
    title: "Общие правила проекта",
    section: "Основные правила",
    group: "general",
    slug: "obshchiye-pravila",
    changes: [
      {
        type: "changed",
        number: "2.2",
        before: "Запрещено иметь более 1-го игрового / форумного аккаунта для одного игрока. | Ban от 15 дней.",
        after:
          "Запрещено иметь более 1-го игрового / форумного аккаунта для одного игрока, если данная возможность используется для обхода игровых систем / наказаний или преднамеренных нарушений. | Ban от 15 дней / Hard Ban от 15 дней.",
      },
    ],
  },
  {
    date: "21.09.2026",
    title: "Правила ограблений и похищений",
    section: "Основные правила",
    group: "general",
    slug: "pravila-ograblenii-i-pokhishchenii",
    changes: [
      {
        type: "changed",
        number: "2.3",
        before: "Запрещено похищать более 3 человек за раз. | Demorgan 30 - 90 минут.",
        after: "Запрещено похищать более 5 человек за раз. | Demorgan 30 - 90 минут.",
      },
    ],
  },
  {
    date: "24.02.2026",
    title: "Правила государственных организаций",
    section: "Государственные структуры",
    group: "government",
    slug: "pravila-gosudarstvennykh-organizatsii",
  },
];

/**
 * Статус актуальности правил. Считается на сервере по журналу фоновой проверки:
 *  - fresh   — раздел недавно сверен с источником, расхождений и ошибок нет;
 *  - stale   — раздел давно не сверялся (проверка не запускалась или сбоит);
 *  - error   — последняя проверка раздела закончилась ошибкой, показан последний сохранённый текст;
 *  - unknown — раздел ещё ни разу не проверялся (показан встроенный текст базы).
 */
export type RuleFreshness = "fresh" | "stale" | "error" | "unknown";

export const ruleFreshnessMeta: Record<RuleFreshness, { label: string; hint: string }> = {
  fresh: { label: "Актуально", hint: "Раздел недавно проверен, текст соответствует источнику" },
  stale: { label: "Давно не проверялось", hint: "Проверка давно не запускалась: текст мог устареть" },
  error: { label: "Не удалось проверить", hint: "Последняя проверка завершилась ошибкой: показан сохранённый текст" },
  unknown: { label: "Ещё не проверялось", hint: "Показан встроенный текст базы, сверка пока не выполнялась" },
};

/** Статус одного раздела правил. */
export type RuleArticleStatus = {
  state: RuleFreshness;
  /** «04.10.2026, 11:00 МСК» — когда раздел последний раз успешно сверен, или null */
  checkedAt: string | null;
};

/** Общий статус набора правил (читается из базы и журнала проверок). */
export type RulesStatus = {
  state: RuleFreshness;
  /** «04.10.2026, 11:00 МСК» — когда фоновая проверка завершилась в последний раз, или null */
  lastChecked: string | null;
  /** false, если в последнем запуске были ошибки */
  ok: boolean;
  total: number;
  fresh: number;
  /** Разделы, которые стоит перепроверить: давно не сверялись, с ошибкой или без проверки */
  needsAttention: number;
};

/** Текст для копирования: «ОП 1.9» (или просто «1.9», если у раздела нет тега). */
export function formatRuleRef(tag: string | undefined, number: string): string {
  return tag ? `${tag} ${number}` : number;
}
