import { countRules, parseRules, type RuleItem } from "@/lib/rules/parse";
import { articleStatus, loadOverrides, type StoredArticle } from "@/lib/rules/store";

import {
  type RuleArticleCard,
  type RuleArticleMeta,
  type RuleArticleView,
  type RuleGroup,
  type RuleSearchEntry,
  ruleGroups,
} from "./rules-meta";

/** Только для серверных компонентов: загружает тексты правил из базы данных. */

/** Разобранный текст раздела. Статус считается отдельно при каждом показе: он меняется и без смены текста. */
type ParsedArticle = Omit<RuleArticleView, "status">;

const cache = new Map<string, ParsedArticle>();

function build(meta: RuleArticleMeta, raw: string, updatedAt: string): ParsedArticle {
  const sections = parseRules(raw);
  return { ...meta, updatedAt, sections, ruleCount: countRules(sections) };
}

/**
 * Текст берётся только из базы правил REGION.HELP. Разобранный текст кешируется по хешу, пока он не изменился.
 */
function resolveParsed(meta: RuleArticleMeta, override: StoredArticle | undefined): ParsedArticle | undefined {
  if (!override) return undefined;
  const raw = override.rawText;

  const key = `${meta.group}/${meta.slug}:${override.hash}`;
  const cached = cache.get(key);
  if (cached) return cached;

  for (const existing of cache.keys()) if (existing.startsWith(`${meta.group}/${meta.slug}:`)) cache.delete(existing);
  const article = build(meta, raw, override.updatedLabel ?? meta.updatedAt);
  cache.set(key, article);
  return article;
}

function resolve(meta: RuleArticleMeta, override: StoredArticle | undefined): RuleArticleView | undefined {
  const parsed = resolveParsed(meta, override);
  return parsed ? { ...parsed, status: articleStatus(override) } : undefined;
}

export function getGroupSlugs(group: RuleGroup): string[] {
  return ruleGroups[group].articles.map((article) => article.slug);
}

export async function getArticle(group: RuleGroup, slug: string): Promise<RuleArticleView | undefined> {
  const meta = ruleGroups[group].articles.find((article) => article.slug === slug);
  if (!meta) return undefined;
  return resolve(meta, (await loadOverrides()).get(slug));
}

export async function getGroupArticles(group: RuleGroup): Promise<RuleArticleView[]> {
  const overrides = await loadOverrides();
  return ruleGroups[group].articles
    .map((meta) => resolve(meta, overrides.get(meta.slug)))
    .filter((article): article is RuleArticleView => Boolean(article));
}

export async function getGroupCards(group: RuleGroup): Promise<RuleArticleCard[]> {
  return (await getGroupArticles(group)).map(({ sections: _sections, ...card }) => card);
}

function toSearchEntry(article: RuleArticleView, sectionTitle: string, rule: RuleItem): RuleSearchEntry {
  const extra = [...rule.items, ...rule.fields.flatMap((field) => [field.label, field.text, ...field.items])]
    .filter(Boolean)
    .join(" ");

  return {
    group: article.group,
    slug: article.slug,
    tag: article.tag,
    articleTitle: article.title,
    sectionTitle,
    number: rule.number,
    anchor: rule.anchor,
    text: rule.text,
    punishments: rule.punishments,
    extra,
  };
}

export async function getSearchIndex(group: RuleGroup): Promise<RuleSearchEntry[]> {
  return (await getGroupArticles(group)).flatMap((article) =>
    article.sections.flatMap((section) =>
      section.entries
        .filter((entry): entry is RuleItem => entry.type === "rule")
        .map((rule) => toSearchEntry(article, section.title, rule)),
    ),
  );
}
