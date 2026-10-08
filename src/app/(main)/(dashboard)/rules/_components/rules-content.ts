import { articleStatus, loadOverrides, type StoredArticle } from "@/lib/rules/store";

import { adminsRules } from "../_content/admins";
import { airdropRules } from "../_content/airdrop";
import { barracksRules } from "../_content/barracks";
import { cheatCheckRules } from "../_content/cheatcheck";
import { familiesRules } from "../_content/families";
import { forumRules } from "../_content/forum";
import { generalRules } from "../_content/general";
import { governmentRules } from "../_content/government";
import { leadersRules } from "../_content/leaders";
import { countRules, parseRules, type RuleItem } from "../_content/parse";
import { propertyRules } from "../_content/property";
import { robberiesRules } from "../_content/robberies";
import { suppliesRules } from "../_content/supplies";
import { zonesRules } from "../_content/zones";
import {
  type RuleArticleCard,
  type RuleArticleMeta,
  type RuleArticleView,
  type RuleGroup,
  type RuleSearchEntry,
  ruleGroups,
} from "./rules-meta";

/** Только для серверных компонентов: подключает полный текст правил. */

const sources: Record<string, string> = {
  "obshchiye-pravila": generalRules,
  "pravila-postavok-i-perekhvata": suppliesRules,
  "pravila-ograblenii-i-pokhishchenii": robberiesRules,
  "pravila-semeinykh-organizatsii": familiesRules,
  "pravila-voiny-za-vozdushnyi-gruz-vza": airdropRules,
  "pravila-dlya-liderov-fraktsii": leadersRules,
  "pravila-i-obyazannosti-administratsii": adminsRules,
  "pravila-napadeniya-na-voinskuyu-chast": barracksRules,
  "pravila-ob-igrovom-imushchestve": propertyRules,
  "pravila-igrovykh-zon": zonesRules,
  "pravila-proverki-na-storonneye-po": cheatCheckRules,
  "pravila-foruma": forumRules,
  "pravila-gosudarstvennykh-organizatsii": governmentRules,
};

/** Разобранный текст раздела. Статус считается отдельно при каждом показе: он меняется и без смены текста. */
type ParsedArticle = Omit<RuleArticleView, "status">;

const cache = new Map<string, ParsedArticle>();

/** Встроенный текст из _content. Нужен как запасной вариант и как точка отсчёта при первой синхронизации. */
export function getStaticSource(slug: string): string | undefined {
  return sources[slug];
}

function build(meta: RuleArticleMeta, raw: string, updatedAt: string): ParsedArticle {
  const sections = parseRules(raw);
  return { ...meta, updatedAt, sections, ruleCount: countRules(sections) };
}

/**
 * Текст берётся из базы правил REGION.HELP, а если там статьи нет или база недоступна, из встроенных файлов _content.
 * Разобранный текст кешируется по хешу, пока он не изменился.
 */
function resolveParsed(meta: RuleArticleMeta, override: StoredArticle | undefined): ParsedArticle | undefined {
  const raw = override?.rawText ?? sources[meta.slug];
  if (raw === undefined) return undefined;

  const key = `${meta.group}/${meta.slug}:${override?.hash ?? "static"}`;
  const cached = cache.get(key);
  if (cached) return cached;

  for (const existing of cache.keys()) if (existing.startsWith(`${meta.group}/${meta.slug}:`)) cache.delete(existing);
  const article = build(meta, raw, override?.updatedLabel ?? meta.updatedAt);
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
