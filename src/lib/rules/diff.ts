import type { RuleChange } from "@/app/(main)/(dashboard)/rules/_components/rules-meta";

import { parseRules, type RuleItem } from "./parse";

/** Пункт в виде строки так же, как в ленте изменений: «Текст. | Наказание 1 / Наказание 2», затем списки и примечания. */
export function serializeRule(rule: RuleItem): string {
  let out = rule.text;
  if (rule.punishments.length > 0) out += ` | ${rule.punishments.join(" / ")}`;
  for (const item of rule.items) out += `\n- ${item}`;
  for (const field of rule.fields) {
    out += `\n${field.label}: ${field.text}`;
    for (const item of field.items) out += `\n- ${item}`;
  }
  return out.trim();
}

/** Убирает шум, который не является правкой: лишние пробелы, точки и запятые в конце строк, «5-10» и «5 - 10». */
function comparable(value: string): string {
  return value
    .split("\n")
    .map((line) =>
      line
        .replace(/\s+/g, " ")
        .replace(/(\d)\s*-\s*(\d)/g, "$1-$2")
        .replace(/[.;,\s]+$/, "")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

function indexRules(raw: string): Map<string, RuleItem> {
  const rules = new Map<string, RuleItem>();
  const seen = new Map<string, number>();
  for (const section of parseRules(raw)) {
    for (const entry of section.entries) {
      if (entry.type !== "rule") continue;
      // На форуме встречаются повторяющиеся номера: второй такой пункт получает ключ «1.5#1».
      const count = seen.get(entry.number) ?? 0;
      seen.set(entry.number, count + 1);
      rules.set(count === 0 ? entry.number : `${entry.number}#${count}`, entry);
    }
  }
  return rules;
}

function compareNumbers(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? -1) - (right[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Сравнивает две версии статьи по номерам пунктов. Пустой результат — содержательных правок нет. */
export function diffRules(oldRaw: string, newRaw: string): RuleChange[] {
  const before = indexRules(oldRaw);
  const after = indexRules(newRaw);
  const changes: RuleChange[] = [];

  for (const [key, rule] of after) {
    const previous = before.get(key);
    if (!previous) {
      changes.push({ type: "added", number: rule.number, after: serializeRule(rule) });
    } else if (comparable(serializeRule(previous)) !== comparable(serializeRule(rule))) {
      changes.push({
        type: "changed",
        number: rule.number,
        before: serializeRule(previous),
        after: serializeRule(rule),
      });
    }
  }
  for (const [key, rule] of before) {
    if (!after.has(key)) changes.push({ type: "removed", number: rule.number, before: serializeRule(rule) });
  }

  return changes.sort((a, b) => compareNumbers(a.number, b.number));
}
