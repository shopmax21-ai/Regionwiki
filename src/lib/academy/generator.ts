import { getGroupArticles } from "@/app/(main)/dashboard/rules/_components/rules-content";
import type { RuleItem } from "@/app/(main)/dashboard/rules/_content/parse";

import type { QuestionDef, RulesConfig } from "./types";

/**
 * Автогенерация вопросов по правилам проекта. Правила берутся из тех же данных, что и раздел «Правила»
 * (с учётом обновлений с форума), поэтому тест всегда соответствует актуальному тексту.
 *
 * Типы вопросов:
 *  - «наказание»: показан пункт, нужно выбрать меру, которая за него положена;
 *  - «раздел»: показан пункт, нужно выбрать раздел статьи, в котором он находится;
 *  - «номер»: показан текст пункта, нужно выбрать его номер (администраторы ссылаются на правила по номерам).
 * Неверные варианты берутся из реальных пунктов правил и подбираются близкими по длине, чтобы верный ответ
 * нельзя было угадать по виду. У каждого вопроса ровно один верный ответ: в вопросе приведён полный текст пункта.
 */

type PoolRule = {
  rule: RuleItem;
  /** Текст пункта, сжатый для вопроса */
  excerpt: string;
  /** Полный текст пункта для разбора */
  fullText: string;
  articleSlug: string;
  articleTitle: string;
  sectionTitle: string;
  /** «ОП 1.7»: тег статьи и номер пункта */
  label: string;
};

type QuestionKind = "punishment" | "section" | "number";

export type GeneratedQuestion = QuestionDef & { source: string };

export class RulesGenerationError extends Error {}

const EXCERPT_LIMIT = 230;
const ANSWER_LIMIT = 200;
const EXPLANATION_LIMIT = 600;
const DISTRACTORS = 3;
/** Доли типов вопросов: «наказание» самый полезный, остальные разбавляют */
const MAX_SHARE: Record<QuestionKind, number> = { punishment: 1, section: 0.3, number: 0.25 };
/** Из скольких случайных кандидатов выбираются самые близкие по длине к верному ответу */
const LENGTH_POOL = 12;

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s.,;:!?«»"'()-]+/g, " ")
    .trim();

function clip(value: string, limit: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > limit * 0.6 ? space : limit).replace(/[\s,;:.-]+$/, "")}…`;
}

/**
 * Статьи правил, из которых делаются вопросы: выбранные группы целиком плюс отдельные разделы ОП.
 * Статья, попавшая в оба списка, берётся один раз.
 */
async function collectArticles(config: RulesConfig) {
  const picked = new Map<string, Awaited<ReturnType<typeof getGroupArticles>>[number]>();
  for (const group of config.groups) {
    for (const article of await getGroupArticles(group)) picked.set(article.slug, article);
  }
  const only = new Set(config.articles ?? []);
  if (only.size > 0) {
    for (const article of await getGroupArticles("general")) {
      if (only.has(article.slug)) picked.set(article.slug, article);
    }
  }
  return [...picked.values()];
}

async function collectPool(config: RulesConfig): Promise<PoolRule[]> {
  const pool: PoolRule[] = [];
  for (const article of await collectArticles(config)) {
    for (const section of article.sections) {
      for (const entry of section.entries) {
        if (entry.type !== "rule") continue;
        const text = entry.text.replace(/\s+/g, " ").trim();
        // Слишком короткие и «вводные» пункты (с двоеточием и списком) без остального текста не имеют смысла
        if (text.length < 30 || text.endsWith(":")) continue;
        pool.push({
          rule: entry,
          excerpt: clip(text, EXCERPT_LIMIT),
          fullText: text,
          articleSlug: article.slug,
          articleTitle: article.title,
          sectionTitle: section.title,
          label: `${article.tag ?? article.title} ${entry.number}`,
        });
      }
    }
  }
  return pool;
}

const punishmentOf = (item: PoolRule) => clip(item.rule.punishments.join(" / "), ANSWER_LIMIT);

/**
 * Выбирает неверные ответы: повторы и совпадения с верным исключаются. Из первых LENGTH_POOL случайных кандидатов
 * берутся самые близкие по длине к верному, чтобы он не выделялся.
 */
function pickDistractors(candidates: readonly string[], correct: string, count = DISTRACTORS): string[] | null {
  const seen = new Set([normalize(correct)]);
  const unique: string[] = [];
  for (const candidate of candidates) {
    const key = normalize(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
    if (unique.length === LENGTH_POOL) break;
  }
  if (unique.length < count) return null;
  return unique
    .sort((a, b) => Math.abs(a.length - correct.length) - Math.abs(b.length - correct.length))
    .slice(0, count);
}

function assemble(
  id: string,
  text: string,
  correct: string,
  distractors: string[],
  explanation: string,
  source: string,
): GeneratedQuestion {
  const answers = shuffle([correct, ...distractors]);
  return { id, text, answers, correct: answers.indexOf(correct), explanation, source };
}

type Context = {
  pool: PoolRule[];
  byArticle: Map<string, PoolRule[]>;
  sectionsByArticle: Map<string, string[]>;
};

function buildContext(pool: PoolRule[]): Context {
  const byArticle = new Map<string, PoolRule[]>();
  const sectionsByArticle = new Map<string, string[]>();
  for (const item of pool) {
    byArticle.set(item.articleSlug, [...(byArticle.get(item.articleSlug) ?? []), item]);
    const sections = sectionsByArticle.get(item.articleSlug) ?? [];
    if (!sections.includes(item.sectionTitle)) sections.push(item.sectionTitle);
    sectionsByArticle.set(item.articleSlug, sections);
  }
  return { pool, byArticle, sectionsByArticle };
}

function punishmentQuestion(id: string, item: PoolRule, ctx: Context): GeneratedQuestion | null {
  if (item.rule.punishments.length === 0) return null;
  const correct = punishmentOf(item);
  const sameArticle = shuffle((ctx.byArticle.get(item.articleSlug) ?? []).filter((other) => other !== item));
  const others = shuffle(ctx.pool.filter((other) => other.articleSlug !== item.articleSlug));
  const options = [...sameArticle, ...others].filter((other) => other.rule.punishments.length > 0).map(punishmentOf);
  const distractors = pickDistractors(options, correct);
  if (!distractors) return null;

  return assemble(
    id,
    `Какое наказание предусмотрено за нарушение: «${item.excerpt}»?`,
    correct,
    distractors,
    `Пункт ${item.label} («${item.articleTitle}», раздел «${item.sectionTitle}»): ${clip(item.fullText, EXPLANATION_LIMIT)}\nНаказание: ${item.rule.punishments.join(" / ")}.`,
    item.label,
  );
}

function sectionQuestion(id: string, item: PoolRule, ctx: Context): GeneratedQuestion | null {
  const sections = ctx.sectionsByArticle.get(item.articleSlug) ?? [];
  const distractors = pickDistractors(shuffle(sections), item.sectionTitle);
  if (!distractors) return null;

  return assemble(
    id,
    `В каком разделе правил «${item.articleTitle}» находится пункт: «${item.excerpt}»?`,
    item.sectionTitle,
    distractors,
    `Пункт ${item.label} находится в разделе «${item.sectionTitle}» правил «${item.articleTitle}»: ${clip(item.fullText, EXPLANATION_LIMIT)}`,
    item.label,
  );
}

function numberQuestion(id: string, item: PoolRule, ctx: Context): GeneratedQuestion | null {
  const answerOf = (rule: PoolRule) => `Пункт ${rule.rule.number}`;
  // Номера берём из той же статьи: они выглядят одинаково правдоподобно
  const sameArticle = shuffle((ctx.byArticle.get(item.articleSlug) ?? []).filter((other) => other !== item));
  const distractors = pickDistractors(sameArticle.map(answerOf), answerOf(item));
  if (!distractors) return null;

  return assemble(
    id,
    `Какой пункт правил «${item.articleTitle}» гласит: «${item.excerpt}»?`,
    answerOf(item),
    distractors,
    `Это пункт ${item.label} («${item.articleTitle}», раздел «${item.sectionTitle}»): ${clip(item.fullText, EXPLANATION_LIMIT)}`,
    item.label,
  );
}

const builders: Record<QuestionKind, (id: string, item: PoolRule, ctx: Context) => GeneratedQuestion | null> = {
  punishment: punishmentQuestion,
  section: sectionQuestion,
  number: numberQuestion,
};

/** Подбирает порядок типов для пункта: «наказание» первым, если оно есть у пункта, остальные в случайном порядке. */
function kindOrder(item: PoolRule): QuestionKind[] {
  const rest = shuffle<QuestionKind>(["section", "number"]);
  return item.rule.punishments.length > 0 && Math.random() < 0.65 ? ["punishment", ...rest] : [...rest, "punishment"];
}

/**
 * Собирает вопросы для одного прохождения. Каждый раз набор и порядок разные.
 * Бросает RulesGenerationError, если подходящих пунктов слишком мало.
 */
export async function generateRulesQuestions(config: RulesConfig): Promise<GeneratedQuestion[]> {
  const pool = await collectPool(config);
  if (pool.length < 8) {
    throw new RulesGenerationError("В выбранных правилах недостаточно пунктов для генерации вопросов");
  }

  const ctx = buildContext(pool);
  const limits: Record<QuestionKind, number> = {
    punishment: Math.ceil(config.questionCount * MAX_SHARE.punishment),
    section: Math.ceil(config.questionCount * MAX_SHARE.section),
    number: Math.ceil(config.questionCount * MAX_SHARE.number),
  };
  const used: Record<QuestionKind, number> = { punishment: 0, section: 0, number: 0 };
  const questions: GeneratedQuestion[] = [];
  // Один пункт — один вопрос; два вопроса про один и тот же текст не задаём
  const seenText = new Set<string>();

  for (const item of shuffle(pool)) {
    if (questions.length >= config.questionCount) break;
    const key = normalize(item.excerpt);
    if (seenText.has(key)) continue;

    for (const kind of kindOrder(item)) {
      if (used[kind] >= limits[kind]) continue;
      const question = builders[kind](`q${questions.length + 1}`, item, ctx);
      if (!question) continue;
      questions.push(question);
      used[kind]++;
      seenText.add(key);
      break;
    }
  }

  if (questions.length < Math.min(config.questionCount, 3)) {
    throw new RulesGenerationError("Не удалось составить достаточно вопросов по выбранным правилам");
  }
  return questions;
}
