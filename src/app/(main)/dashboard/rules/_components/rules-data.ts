export type RuleSection = "general" | "government";

export type RuleArticle = {
  title: string;
  updatedAt: string;
  source: string;
};

export const ruleSources = {
  general: "https://forum.region.game/forums/obshchiye-pravila-proyekta.43/",
  government: "https://forum.region.game/forums/pravila-gosudarstvennykh-organizatsii.3/",
};

export const rules = {
  general: {
    title: "Основные правила",
    description: "Общие правила проекта, игровые ситуации и ответственность игроков.",
    source: ruleSources.general,
    articles: [
      ["Общие правила", "21.09.2026"],
      ["Правила поставок и перехвата", "22.09.2026"],
      ["Правила ограблений и похищений", "21.09.2026"],
      ["Правила семейных организаций", "21.09.2026"],
      ["Правила Войны за Воздушный груз [ВЗА]", "21.09.2026"],
      ["Правила для лидеров фракций", "29.05.2026"],
      ["Правила и обязанности администрации", "24.05.2026"],
      ["Правила нападения на Воинскую Часть", "19.05.2026"],
      ["Правила об игровом имуществе", "27.04.2026"],
      ["Правила игровых зон", "04.04.2026"],
      ["Правила проверки на стороннее ПО", "05.03.2026"],
      ["Правила форума", "08.12.2025"],
    ].map(([title, updatedAt]) => ({ title, updatedAt, source: ruleSources.general })),
  },
  government: {
    title: "Правила государственных структур",
    description: "Порядок работы государственных организаций и фракционной игры.",
    source: ruleSources.government,
    articles: [
      { title: "Правила государственных организаций", updatedAt: "24.02.2026", source: ruleSources.government },
    ],
  },
} satisfies Record<RuleSection, { title: string; description: string; source: string; articles: RuleArticle[] }>;

export const changelog = [
  { date: "22.09.2026", title: "Правила поставок и перехвата", section: "Основные правила" },
  { date: "21.09.2026", title: "Общие правила проекта", section: "Основные правила" },
  { date: "21.09.2026", title: "Правила ограблений и похищений", section: "Основные правила" },
  { date: "24.02.2026", title: "Правила государственных организаций", section: "Государственные структуры" },
];

export const syncInfo = {
  interval: "Каждые 3 часа",
  lastChecked: "01.10.2026, 11:00",
  status: "Синхронизация включена",
};
