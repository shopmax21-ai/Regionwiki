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

const cache = new Map<string, RuleArticleView>();

function build(meta: RuleArticleMeta): RuleArticleView {
  const raw = sources[meta.slug];
  const sections = parseRules(raw ?? "");
  return { ...meta, sections, ruleCount: countRules(sections) };
}

export function getGroupSlugs(group: RuleGroup): string[] {
  return ruleGroups[group].articles.map((article) => article.slug);
}

export function getArticle(group: RuleGroup, slug: string): RuleArticleView | undefined {
  const meta = ruleGroups[group].articles.find((article) => article.slug === slug);
  if (!meta || !(slug in sources)) return undefined;

  const key = `${group}/${slug}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const article = build(meta);
  cache.set(key, article);
  return article;
}

export function getGroupArticles(group: RuleGroup): RuleArticleView[] {
  return ruleGroups[group].articles
    .map((meta) => getArticle(group, meta.slug))
    .filter((article): article is RuleArticleView => Boolean(article));
}

export function getGroupCards(group: RuleGroup): RuleArticleCard[] {
  return getGroupArticles(group).map(({ sections: _sections, ...card }) => card);
}

function toSearchEntry(article: RuleArticleView, sectionTitle: string, rule: RuleItem): RuleSearchEntry {
  const extra = [
    ...rule.items,
    ...rule.fields.flatMap((field) => [field.label, field.text, ...field.items]),
  ]
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

export function getSearchIndex(group: RuleGroup): RuleSearchEntry[] {
  return getGroupArticles(group).flatMap((article) =>
    article.sections.flatMap((section) =>
      section.entries
        .filter((entry): entry is RuleItem => entry.type === "rule")
        .map((rule) => toSearchEntry(article, section.title, rule)),
    ),
  );
}
