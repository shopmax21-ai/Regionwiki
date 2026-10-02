export type RuleFieldKind = "note" | "explanation" | "example" | "exception";

export type RuleField = {
  kind: RuleFieldKind;
  /** Подпись так, как она написана в правилах: «Примечание», «Пояснение», «Примеры» и т.д. */
  label: string;
  text: string;
  items: string[];
};

export type RuleItem = {
  type: "rule";
  /** Номер пункта, например «4.9» */
  number: string;
  /** Якорь для ссылок, например «rule-4-9» */
  anchor: string;
  text: string;
  items: string[];
  /** Наказания по пункту (каждое — отдельная мера) */
  punishments: string[];
  /** Примечания, пояснения, примеры и исключения в порядке следования */
  fields: RuleField[];
};

export type TextItem = {
  type: "text";
  text: string;
  items: string[];
};

export type SectionEntry = RuleItem | TextItem;

export type RuleSectionData = {
  id: string;
  title: string;
  entries: SectionEntry[];
};

const FIELD_KINDS: Record<string, RuleFieldKind> = {
  примечание: "note",
  пояснение: "explanation",
  разъяснение: "explanation",
  пример: "example",
  примеры: "example",
  исключение: "exception",
};

const RULE_START = /^(\d+(?:\.\d+)+)\s+(.*)$/;
const FIELD_START = /^(Примечание|Пояснение|Разъяснение|Примеры|Пример|Исключение|Наказание)\s*:\s*(.*)$/;
const BULLET = /^[-•]\s+(.*)$/;

export function splitPunishments(raw: string): string[] {
  return raw
    .split(/\s+\/\s+|\s+\|\s+/)
    .map((part) => part.trim().replace(/[.;,]+$/, "").trim())
    .filter(Boolean);
}

function appendText(current: string, line: string): string {
  return current ? `${current}\n${line}` : line;
}

/**
 * Разбирает текст правил в структуру «раздел → пункты».
 *
 * Формат:
 *   ## Название раздела
 *   4.9 Текст пункта. | Наказание 1 / Наказание 2
 *   Пояснение: ...
 *   Примечание: ...
 *   Пример: ...
 *   Исключение: ...
 *   - элемент списка (относится к последнему блоку выше)
 *
 * Пустая строка завершает пункт.
 */
export function parseRules(raw: string): RuleSectionData[] {
  const sections: RuleSectionData[] = [];
  let section: RuleSectionData | null = null;
  let rule: RuleItem | null = null;
  let textBlock: TextItem | null = null;
  let field: RuleField | null = null;

  const ensureSection = (): RuleSectionData => {
    if (!section) {
      section = { id: "section-0", title: "Общие положения", entries: [] };
      sections.push(section);
    }
    return section;
  };

  const closeBlock = () => {
    rule = null;
    textBlock = null;
    field = null;
  };

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      closeBlock();
      continue;
    }

    if (line.startsWith("## ")) {
      closeBlock();
      section = { id: `section-${sections.length + 1}`, title: line.slice(3).trim(), entries: [] };
      sections.push(section);
      continue;
    }

    const ruleMatch = line.match(RULE_START);
    if (ruleMatch) {
      closeBlock();
      const [, number, rest] = ruleMatch;
      const separator = rest.indexOf(" | ");
      const text = separator === -1 ? rest : rest.slice(0, separator);
      const punishments = separator === -1 ? [] : splitPunishments(rest.slice(separator + 3));
      const created: RuleItem = {
        type: "rule",
        number,
        anchor: `rule-${number.replace(/\./g, "-")}`,
        text: text.trim(),
        items: [],
        punishments,
        fields: [],
      };
      ensureSection().entries.push(created);
      rule = created;
      continue;
    }

    const fieldMatch = line.match(FIELD_START);
    if (fieldMatch && rule) {
      const [, label, value] = fieldMatch;
      if (label === "Наказание") {
        rule.punishments.push(...splitPunishments(value));
        field = null;
        continue;
      }
      const created: RuleField = {
        kind: FIELD_KINDS[label.toLowerCase()],
        label,
        text: value.trim(),
        items: [],
      };
      rule.fields.push(created);
      field = created;
      continue;
    }

    const bulletMatch = line.match(BULLET);
    if (bulletMatch) {
      const value = bulletMatch[1].trim();
      if (field) field.items.push(value);
      else if (rule) rule.items.push(value);
      else if (textBlock) textBlock.items.push(value);
      else {
        const created: TextItem = { type: "text", text: "", items: [value] };
        ensureSection().entries.push(created);
        textBlock = created;
      }
      continue;
    }

    // Обычная строка — продолжение текущего блока или новый текстовый блок
    if (field) field.text = appendText(field.text, line);
    else if (rule) rule.text = appendText(rule.text, line);
    else if (textBlock) textBlock.text = appendText(textBlock.text, line);
    else {
      const created: TextItem = { type: "text", text: line, items: [] };
      ensureSection().entries.push(created);
      textBlock = created;
    }
  }

  return sections;
}

export function countRules(sections: RuleSectionData[]): number {
  return sections.reduce((total, s) => total + s.entries.filter((entry) => entry.type === "rule").length, 0);
}
