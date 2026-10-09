import type { RuleItem, TextItem } from "@/lib/rules/parse";
import type { SmartDoc } from "@/lib/rules/smart-search";

import type { RuleArticleView, RuleSearchEntry } from "./rules-meta";

/** Пункт из индекса группы правил → запись для умного поиска. */
export function entryToDoc(entry: RuleSearchEntry): SmartDoc {
  return {
    key: `${entry.slug}#${entry.anchor}`,
    tag: entry.tag,
    number: entry.number,
    article: entry.articleTitle,
    section: entry.sectionTitle,
    text: [entry.text, ...entry.items].filter(Boolean).join("\n"),
    punishments: entry.punishments,
    notes: entry.notes,
  };
}

export function textBlockKey(sectionId: string, position: number): string {
  return `${sectionId}:text-${position}`;
}

function ruleToDoc(article: RuleArticleView, sectionTitle: string, rule: RuleItem): SmartDoc {
  return {
    key: rule.anchor,
    tag: article.tag,
    number: rule.number,
    // Название раздела совпало бы со всеми пунктами внутри самого раздела, поэтому здесь оно пустое
    article: "",
    section: sectionTitle,
    text: [rule.text, ...rule.items].filter(Boolean).join("\n"),
    punishments: rule.punishments,
    notes: rule.fields.map((field) => ({
      label: field.label,
      text: [field.text, ...field.items].filter(Boolean).join(" "),
    })),
  };
}

function textBlockToDoc(sectionId: string, sectionTitle: string, position: number, block: TextItem): SmartDoc {
  return {
    key: textBlockKey(sectionId, position),
    number: "",
    article: "",
    section: sectionTitle,
    text: [block.text, ...block.items].filter(Boolean).join("\n"),
    punishments: [],
    notes: [],
  };
}

/** Все пункты и текстовые блоки одного раздела правил, по порядку. */
export function articleToDocs(article: RuleArticleView): SmartDoc[] {
  return article.sections.flatMap((section) =>
    section.entries.map((entry, position) =>
      entry.type === "rule"
        ? ruleToDoc(article, section.title, entry)
        : textBlockToDoc(section.id, section.title, position, entry),
    ),
  );
}
