import type { RuleSectionData } from "../_content/parse";

/**
 * Клиент-безопасные данные о разделах правил (без самого текста правил).
 * Текст правил лежит в ../_content и подключается только на сервере через rules-content.ts.
 */

export type RuleGroup = "general" | "government";

export type RuleArticleMeta = {
  slug: string;
  group: RuleGroup;
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
        title: "Общие правила",
        updatedAt: "21.09.2026",
        description: "Положения проекта, аккаунты, чаты, RolePlay-процесс, отыгровки, модерируемые платформы",
      },
      {
        slug: "pravila-postavok-i-perekhvata",
        group: "general",
        title: "Правила поставок и перехвата",
        updatedAt: "22.09.2026",
        description: "Порядок поставок и перехватов для государственных структур и нелегальных организаций",
      },
      {
        slug: "pravila-ograblenii-i-pokhishchenii",
        group: "general",
        title: "Правила ограблений и похищений",
        updatedAt: "21.09.2026",
        description: "Похищения, ограбления, выкуп, правила жертвы и выкупающей стороны",
      },
      {
        slug: "pravila-semeinykh-organizatsii",
        group: "general",
        title: "Правила семейных организаций",
        updatedAt: "21.09.2026",
        description: "Деятельность семей, дипломатия и санкции",
      },
      {
        slug: "pravila-voiny-za-vozdushnyi-gruz-vza",
        group: "general",
        title: "Правила Войны за Воздушный груз [ВЗА]",
        updatedAt: "21.09.2026",
        description: "Регулярное мероприятие: зоны, расписание, дресс-код и запреты",
      },
      {
        slug: "pravila-dlya-liderov-fraktsii",
        group: "general",
        title: "Правила для лидеров фракций",
        updatedAt: "29.05.2026",
        description: "Лидерский срок, обязанности лидеров и ограничения",
      },
      {
        slug: "pravila-i-obyazannosti-administratsii",
        group: "general",
        title: "Правила и обязанности администрации",
        updatedAt: "24.05.2026",
        description: "Регламент работы администраторов, игровое имущество и обязанности куратора",
      },
      {
        slug: "pravila-napadeniya-na-voinskuyu-chast",
        group: "general",
        title: "Правила нападения на Воинскую Часть",
        updatedAt: "19.05.2026",
        description: "Порядок нападения, правила для Вооружённых Сил, госструктур и криминальных семей",
      },
      {
        slug: "pravila-ob-igrovom-imushchestve",
        group: "general",
        title: "Правила об игровом имуществе",
        updatedAt: "27.04.2026",
        description: "Покупка и продажа имущества, бизнесы, дома, мошенничество и монополии",
      },
      {
        slug: "pravila-igrovykh-zon",
        group: "general",
        title: "Правила игровых зон",
        updatedAt: "04.04.2026",
        description: "Зелёная, красная, серая и голубая зоны",
      },
      {
        slug: "pravila-proverki-na-storonneye-po",
        group: "general",
        title: "Правила проверки на стороннее ПО",
        updatedAt: "05.03.2026",
        description: "Как проводится проверка, права игрока и обязанности администратора",
      },
      {
        slug: "pravila-foruma",
        group: "general",
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
        title: "Правила государственных организаций",
        updatedAt: "24.02.2026",
        description: "Общие положения, кадры, Правительство, Вооружённые силы, МВД / ГИБДД, ЦГБ, СМИ, новости, суд и прокуратура",
      },
    ],
  },
};

export function articleHref(group: RuleGroup, slug: string): string {
  return `/dashboard/rules/${group}/${slug}`;
}

export type RuleArticleView = RuleArticleMeta & {
  ruleCount: number;
  sections: RuleSectionData[];
};

/** Краткая запись пункта для поиска по всей группе правил. */
export type RuleSearchEntry = {
  group: RuleGroup;
  slug: string;
  articleTitle: string;
  sectionTitle: string;
  number: string;
  anchor: string;
  text: string;
  punishments: string[];
  /** Всё остальное: списки, примечания, пояснения, примеры, исключения */
  extra: string;
};

export type RuleArticleCard = RuleArticleMeta & { ruleCount: number };

export const changelog: {
  date: string;
  title: string;
  section: string;
  group: RuleGroup;
  slug: string;
}[] = [
  {
    date: "22.09.2026",
    title: "Правила поставок и перехвата",
    section: "Основные правила",
    group: "general",
    slug: "pravila-postavok-i-perekhvata",
  },
  {
    date: "21.09.2026",
    title: "Общие правила проекта",
    section: "Основные правила",
    group: "general",
    slug: "obshchiye-pravila",
  },
  {
    date: "21.09.2026",
    title: "Правила ограблений и похищений",
    section: "Основные правила",
    group: "general",
    slug: "pravila-ograblenii-i-pokhishchenii",
  },
  {
    date: "24.02.2026",
    title: "Правила государственных организаций",
    section: "Государственные структуры",
    group: "government",
    slug: "pravila-gosudarstvennykh-organizatsii",
  },
];

export const syncInfo = {
  interval: "Каждые 3 часа",
  lastChecked: "01.10.2026, 11:00",
  status: "Синхронизация включена",
};
