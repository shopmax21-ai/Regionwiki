import { getGroupArticles } from "@/app/(main)/dashboard/rules/_components/rules-content";

import type { RulePointHit } from "./types";

type IndexedRule = RulePointHit & { haystack: string };

const TTL_MS = 5 * 60_000;
let cache: { at: number; rules: IndexedRule[] } | null = null;

const clip = (value: string, limit: number) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= limit ? text : `${text.slice(0, limit).trimEnd()}…`;
};

/** Все пункты правил (основные и государственных структур) с актуальным текстом. Хранится в памяти несколько минут. */
async function loadRules(): Promise<IndexedRule[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rules;

  const rules: IndexedRule[] = [];
  for (const group of ["general", "government"] as const) {
    for (const article of await getGroupArticles(group)) {
      for (const section of article.sections) {
        for (const entry of section.entries) {
          if (entry.type !== "rule") continue;
          const label = `${(article.tag ?? article.title).toUpperCase()} ${entry.number}`;
          const text = clip(entry.text, 160);
          rules.push({
            label,
            text,
            punishments: entry.punishments,
            haystack: `${label} ${text} ${entry.punishments.join(" ")}`.toLowerCase(),
          });
        }
      }
    }
  }
  cache = { at: Date.now(), rules };
  return rules;
}

/**
 * Поиск пунктов правил для подсказок в форме: по номеру («оп 4.9», «4.9») или по словам из текста.
 * Совпадения по номеру идут первыми.
 */
export async function searchRulePoints(query: string, limit = 12): Promise<RulePointHit[]> {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized.length < 1) return [];

  const rules = await loadRules();
  const tokens = normalized.split(" ");
  const matches = rules.filter((rule) => tokens.every((token) => rule.haystack.includes(token)));

  const byLabel = (rule: IndexedRule) => {
    const label = rule.label.toLowerCase();
    if (label === normalized || label.replace(" ", "") === normalized.replace(" ", "")) return 0;
    if (label.startsWith(normalized) || label.split(" ")[1]?.startsWith(normalized)) return 1;
    return 2;
  };

  return matches
    .sort((a, b) => byLabel(a) - byLabel(b))
    .slice(0, limit)
    .map(({ label, text, punishments }) => ({ label, text, punishments }));
}
