export type RuleFieldKind = "note" | "explanation" | "example" | "exception";
export type RuleField = { kind: RuleFieldKind; label: string; text: string; items: string[] };
export type RuleItem = {
  type: "rule";
  number: string;
  anchor: string;
  text: string;
  items: string[];
  fields: RuleField[];
  punishments: string[];
};
export type SectionEntry = RuleItem | { type: "text"; text: string; items: string[] };
export type RuleSectionData = { id: string; title: string; entries: SectionEntry[] };

export function parseRules(raw: string): RuleSectionData[] {
  if (!raw.trim()) return [];
  return [
    {
      id: "rules",
      title: "Правила",
      entries: [
        { type: "rule", number: "1", anchor: "rule-1", text: raw.trim(), items: [], fields: [], punishments: [] },
      ],
    },
  ];
}

export function countRules(sections: RuleSectionData[]): number {
  return sections.reduce((total, section) => total + section.entries.length, 0);
}
