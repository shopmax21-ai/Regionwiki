/**
 * «Умный» поиск по правилам. Чистый TypeScript без зависимостей от React и сервера: работает и в браузере, и на сервере.
 *
 * Что умеет:
 * - окончания и падежи («ограбление» находит «ограбления», «ограблений»), «ё» = «е», набор слова на лету;
 * - опечатки («ограбленин», «деморган» → «Деморган») и неверную раскладку («ghfdbkf» → «правила»);
 * - номер пункта: «4.9», «оп 4.9», «оп4.9» (точный пункт, затем вложенные);
 * - сокращения и ситуации из словаря: «убили без причины» → DM, «перекрыл дорогу», «как обжаловать бан»;
 * - поиск по наказаниям, примечаниям, примерам и заголовкам; редкие слова весят больше частых;
 * - если по всем словам ничего нет, показывает пункты, подходящие под часть запроса.
 */

import { type SearchConcept, searchConcepts, searchStopWords } from "./search-dictionary";

// ——— Типы ———

export type SmartDoc = {
  /** Уникальный ключ записи (для React и фильтров) */
  key: string;
  /** Короткий тег раздела, например «ОП» */
  tag?: string;
  /** Номер пункта, например «4.9». Пусто у текстовых блоков без номера */
  number: string;
  article: string;
  section: string;
  /** Текст пункта вместе с пунктами списка */
  text: string;
  punishments: string[];
  /** Примечания, пояснения, примеры, исключения */
  notes: { label: string; text: string }[];
};

export type SmartHit = {
  doc: SmartDoc;
  index: number;
  score: number;
  /** Где нашлось (по убыванию важности): пункт, наказание, примечание, заголовок… */
  where: SmartField[];
  /** Идентификаторы ситуаций из словаря, по которым найден этот пункт */
  via: string[];
};

export type SmartField = "number" | "text" | "punishment" | "note" | "section" | "article";

export type SmartResult = {
  query: string;
  hits: SmartHit[];
  /** Регулярное выражение для подсветки найденных слов (null, если подсвечивать нечего) */
  highlight: RegExp | null;
  /** Распознанные ситуации и сокращения из словаря */
  concepts: { id: string; label: string }[];
  /** Исправленные опечатки */
  corrections: { from: string; to: string }[];
  /** Если запрос набран не в той раскладке: во что он превращён */
  layoutFixed: string | null;
  /** true, если подходят не все слова запроса, а только часть */
  partial: boolean;
};

export type RuleSearcher = {
  search: (query: string) => SmartResult;
};

// ——— Нормализация и стемминг ———

const normalize = (value: string) => value.toLowerCase().replaceAll("ё", "е");

const WORD = /[\p{L}\p{N}]+(?:\.[\p{N}]+)*/gu;
const CYRILLIC = /^[а-я]+$/;
const REF = /^\d+(?:\.\d+)+$/;
const INTEGER = /^\d{1,3}$/;

const SUFFIXES = [
  "ениями", "ениям", "ениях", "ении", "ения", "ение", "ений", "ости", "ость", "ами", "ями", "ого", "его", "ому", "ему",
  "ыми", "ими", "ов", "ев", "ей", "ой", "ий", "ый", "ая", "яя", "ое", "ее", "ие", "ые", "ую", "юю", "ах", "ях", "ом",
  "ем", "ам", "ям", "ою", "ею", "ть", "ти", "ла", "ли", "ло", "ет", "ут", "ют", "ит", "ат", "ят", "ешь", "ишь", "ся",
  "сь", "а", "я", "о", "е", "ы", "и", "у", "ю", "ь", "й",
].sort((a, b) => b.length - a.length);

/** Грубое отсечение окончаний. Только для русских слов; латиница и числа почти не меняются. */
function stem(word: string): string {
  if (!CYRILLIC.test(word)) {
    return word.length >= 5 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
  }
  let result = word;
  for (let pass = 0; pass < 2; pass++) {
    if (result.length < 4) break;
    const suffix = SUFFIXES.find((item) => result.endsWith(item) && result.length - item.length >= 3);
    if (!suffix) break;
    result = result.slice(0, -suffix.length);
  }
  return result;
}

type Token = { surface: string; stem: string; stop: boolean };

const LATIN_LOOKALIKES: Record<string, string> = {
  a: "а", b: "в", c: "с", e: "е", h: "н", k: "к", m: "м", o: "о", p: "р", t: "т", x: "х", y: "у",
};

/** Слово, набранное вперемешку латиницей и кириллицей («бaн» с латинской a), приводится к кириллице. */
function unmix(word: string): string {
  if (!/[a-z]/.test(word) || !/[а-я]/.test(word)) return word;
  return word.replace(/[a-z]/g, (char) => LATIN_LOOKALIKES[char] ?? char);
}

function tokenize(value: string): Token[] {
  const words = (normalize(value).match(WORD) ?? []).map(unmix);
  return words.map((surface) => ({
    surface,
    stem: REF.test(surface) || /\d/.test(surface) ? surface : stem(surface),
    stop: searchStopWords.has(surface),
  }));
}

/** Слова без стоп-слов (для расширений словаря и документов). Если остались одни стоп-слова, берёт их. */
function contentStems(value: string): string[] {
  const tokens = tokenize(value);
  const content = tokens.filter((token) => !token.stop);
  return (content.length > 0 ? content : tokens).map((token) => token.stem);
}

/** Склеенные «оп4.9», «оп.4.9», «4,9» превращаются в «оп 4.9» и «4.9». */
function prepareQuery(query: string): string {
  return query
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(^|\s)([a-zA-Zа-яА-ЯёЁ]{1,4})[\s.:-]*(\d+(?:[.,]\d+)+)/g, "$1$2 $3")
    .replace(/[.]+(?=\s|$)/g, "");
}

// ——— Раскладка клавиатуры ———

const EN_LAYOUT = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const RU_LAYOUT = "йцукенгшщзхъфывапролджэячсмитьбюё";

function swapLayout(value: string): string {
  const lower = value.toLowerCase();
  const latin = (lower.match(/[a-z]/g) ?? []).length;
  const cyrillic = (lower.match(/[а-яё]/g) ?? []).length;
  if (latin === 0 && cyrillic === 0) return value;
  const [from, to] = latin >= cyrillic ? [EN_LAYOUT, RU_LAYOUT] : [RU_LAYOUT, EN_LAYOUT];
  let result = "";
  for (const char of lower) {
    const position = from.indexOf(char);
    result += position === -1 ? char : to[position];
  }
  return result;
}

// ——— Сопоставление слов ———

/**
 * Слова совпадают: равны, либо одно — начало другого (для слов от 4 букв, отличие не больше трёх букв).
 * Пара вроде «сторонн» / «сторон» (удвоенная буква) — разные слова, их не смешиваем.
 */
function stemsMatch(query: string, word: string, typing: boolean): boolean {
  if (query === word) return true;
  if (typing && query.length >= 3 && word.startsWith(query)) return true;
  const [short, long] = query.length <= word.length ? [query, word] : [word, query];
  if (short.length < 4 || !long.startsWith(short)) return false;
  const extra = long.length - short.length;
  if (extra > 3) return false;
  return !(extra === 1 && long[short.length] === short[short.length - 1]);
}

/** Расстояние Дамерау — Левенштейна с ранним выходом, если оно больше предела. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push(new Array<number>(b.length + 1).fill(0));
    rows[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    let rowMin = Number.POSITIVE_INFINITY;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
  }
  return rows[a.length][b.length];
}

// ——— Индекс ———

const BIT = { text: 1, section: 2, article: 4, punishment: 8, note: 16, tag: 32, number: 64 } as const;
const BIT_WEIGHT: [number, number][] = [
  [BIT.text, 3],
  [BIT.tag, 2.6],
  [BIT.punishment, 2.4],
  [BIT.section, 2],
  [BIT.note, 1.5],
  [BIT.article, 1.2],
];

const bitsWeight = (bits: number) => BIT_WEIGHT.reduce((best, [bit, weight]) => (bits & bit ? Math.max(best, weight) : best), 0);

type Index = {
  docs: SmartDoc[];
  /** слово → документ → в каких полях встретилось */
  postings: Map<string, Map<number, number>>;
  /** слова по первой букве, чтобы не перебирать весь словарь */
  byFirst: Map<string, string[]>;
  /** слово → как оно записано в правилах (для показа исправлений) */
  display: Map<string, string>;
  /** сколько документов содержат слово (для веса редких слов) */
  frequency: Map<string, number>;
  tags: Set<string>;
};

function buildIndex(docs: SmartDoc[]): Index {
  const postings = new Map<string, Map<number, number>>();
  const display = new Map<string, string>();
  const tags = new Set<string>();

  const add = (value: string, bit: number, docIndex: number) => {
    for (const token of tokenize(value)) {
      let docsOfStem = postings.get(token.stem);
      if (!docsOfStem) {
        docsOfStem = new Map();
        postings.set(token.stem, docsOfStem);
        display.set(token.stem, token.surface);
      }
      docsOfStem.set(docIndex, (docsOfStem.get(docIndex) ?? 0) | bit);
    }
  };

  docs.forEach((doc, index) => {
    add(doc.text, BIT.text, index);
    add(doc.section, BIT.section, index);
    add(doc.article, BIT.article, index);
    for (const punishment of doc.punishments) add(punishment, BIT.punishment, index);
    for (const note of doc.notes) add(`${note.label} ${note.text}`, BIT.note, index);
    if (doc.tag) {
      const tag = normalize(doc.tag);
      tags.add(tag);
      add(tag, BIT.tag, index);
    }
  });

  const byFirst = new Map<string, string[]>();
  const frequency = new Map<string, number>();
  for (const [word, docsOfWord] of postings) {
    frequency.set(word, docsOfWord.size);
    const list = byFirst.get(word[0]) ?? [];
    list.push(word);
    byFirst.set(word[0], list);
  }

  return { docs, postings, byFirst, display, frequency, tags };
}


type Nearest = { word: string; shown: string; dist: number; freq: number };

/** Ближайшее известное слово (из правил или словаря ситуаций) не дальше одной-двух правок. */
function findNearest(index: Index, extra: Map<string, string>, word: string): Nearest | null {
  const limit = word.length <= 6 ? 1 : 2;
  let best: Nearest | null = null;

  const consider = (candidate: string, shown: string, freq: number) => {
    let dist = distance(word, candidate, limit);
    // Опечатка в окончании: «ограбленин» ≈ основа «ограбл» + ещё одна буква
    if (dist > limit && candidate.length >= 5) {
      dist = distance(word.slice(0, candidate.length + 1), candidate, limit);
    }
    if (dist > limit) return;
    if (best === null || dist < best.dist || (dist === best.dist && freq > best.freq)) {
      best = { word: candidate, shown, dist, freq };
    }
  };

  for (const [candidate, freq] of index.frequency) consider(candidate, index.display.get(candidate) ?? candidate, freq);
  for (const [candidate, shown] of extra) consider(candidate, shown, 0);
  return best;
}

// ——— Словарь ситуаций (разбирается один раз) ———

type ParsedConcept = {
  concept: SearchConcept;
  triggers: string[][];
  expand: string[][];
  related: string[][];
};

let parsedConcepts: ParsedConcept[] | null = null;
const silentConcepts = new Set(searchConcepts.filter((concept) => concept.silent).map((concept) => concept.id));
let conceptWords: Map<string, string> | null = null;

function getConcepts(): ParsedConcept[] {
  if (parsedConcepts) return parsedConcepts;
  parsedConcepts = searchConcepts.map((concept) => ({
    concept,
    triggers: concept.triggers.map((trigger) => tokenize(trigger).map((token) => token.stem)),
    expand: concept.expand.map(contentStems),
    related: (concept.related ?? []).map(contentStems),
  }));
  conceptWords = new Map();
  for (const item of parsedConcepts) {
    for (const trigger of item.concept.triggers) {
      for (const token of tokenize(trigger)) if (!token.stop) conceptWords.set(token.stem, token.surface);
    }
  }
  return parsedConcepts;
}

// ——— Поиск ———

type Alt = {
  stems: string[];
  weight: number;
  /** Слово вводится прямо сейчас: допускаем, что оно не дописано */
  typing?: boolean;
  /** Номер пункта вместо слов */
  ref?: string;
  /** Для целого числа: искать и пункты, номер которых начинается с него */
  refPrefix?: boolean;
  concept?: string;
};

type Group = { alts: Alt[] };

type AltMatch = { score: number; bits: number };
type StemMatches = { docs: Map<number, number>; count: number };

function runSearch(index: Index, rawQuery: string): SmartResult {
  const parsed = getConcepts();
  const query = prepareQuery(rawQuery);
  const tokens = tokenize(query);
  const lastIndex = (() => {
    for (let i = tokens.length - 1; i >= 0; i--) if (!tokens[i].stop) return i;
    return -1;
  })();
  const typingEnds = !/\s$/.test(rawQuery);

  const matchCache = new Map<string, StemMatches>();
  const matchStem = (word: string, typing: boolean): StemMatches => {
    const key = `${word}|${typing}`;
    const cached = matchCache.get(key);
    if (cached) return cached;
    const docs = new Map<number, number>();
    let count = 0;
    for (const candidate of index.byFirst.get(word[0]) ?? []) {
      if (!stemsMatch(word, candidate, typing)) continue;
      for (const [doc, bits] of index.postings.get(candidate) ?? []) {
        docs.set(doc, (docs.get(doc) ?? 0) | bits);
      }
      count += 1;
    }
    const result = { docs, count };
    matchCache.set(key, result);
    return result;
  };

  // 1. Исправление опечаток: слово, которого нет ни в правилах, ни в словаре ситуаций
  const corrections: { from: string; to: string }[] = [];
  const knownWords = conceptWords ?? new Map<string, string>();
  tokens.forEach((token, position) => {
    if (token.stop || /\d/.test(token.stem) || token.stem.length < 4) return;
    const typing = typingEnds && position === lastIndex;
    if (matchStem(token.stem, typing).docs.size > 0 || knownWords.has(token.stem)) return;

    const nearest = findNearest(index, knownWords, token.stem);
    if (!nearest) return;
    corrections.push({ from: token.surface, to: nearest.shown });
    token.stem = nearest.word;
    token.surface = nearest.shown;
  });

  // 2. Ситуации и сокращения из словаря
  const used = new Set<number>();
  const groups: Group[] = [];
  const triggered: { id: string; label: string }[] = [];

  type Found = { item: ParsedConcept; positions: number[] };
  const found: Found[] = [];
  for (const item of parsed) {
    for (const trigger of item.triggers) {
      if (trigger.length === 0) continue;
      const positions: number[] = [];
      const taken = new Set<number>();
      for (const want of trigger) {
        const at = tokens.findIndex((token, position) => !taken.has(position) && stemsMatch(want, token.stem, false));
        if (at === -1) break;
        taken.add(at);
        positions.push(at);
      }
      if (positions.length === trigger.length) found.push({ item, positions });
    }
  }
  found.sort((a, b) => b.positions.length - a.positions.length);

  for (const entry of found) {
    if (entry.positions.some((position) => used.has(position))) continue;
    if (triggered.some((existing) => existing.id === entry.item.concept.id)) continue;
    for (const position of entry.positions) used.add(position);
    triggered.push({ id: entry.item.concept.id, label: entry.item.concept.label });

    const literal = entry.positions
      .map((position) => tokens[position])
      .filter((token) => !token.stop)
      .map((token) => token.stem);
    const id = entry.item.concept.id;
    const alts: Alt[] = [];
    if (literal.length > 0) alts.push({ stems: literal, weight: 1, concept: id });
    for (const stems of entry.item.expand) if (stems.length > 0) alts.push({ stems, weight: 0.85, concept: id });
    for (const stems of entry.item.related) if (stems.length > 0) alts.push({ stems, weight: 0.45, concept: id });
    groups.push({ alts });
  }

  // 3. Остальные слова запроса
  const collect = (includeStops: boolean) => {
    tokens.forEach((token, position) => {
      if (used.has(position)) return;
      if (token.stop && !includeStops) return;

      if (REF.test(token.stem)) {
        groups.push({ alts: [{ stems: [], weight: 1, ref: token.stem }] });
        return;
      }
      const typing = typingEnds && position === lastIndex;
      const alts: Alt[] = [{ stems: [token.stem], weight: 1, typing }];
      if (INTEGER.test(token.stem)) alts.push({ stems: [], weight: 1, ref: token.stem, refPrefix: true });
      groups.push({ alts });
    });
  };
  collect(false);
  if (groups.length === 0) {
    // Одни служебные слова («правила», «по»): ищем только тег раздела, например «ПО»
    tokens.forEach((token, position) => {
      if (!used.has(position) && index.tags.has(token.surface)) {
        groups.push({ alts: [{ stems: [token.stem], weight: 1 }] });
      }
    });
  }

  if (groups.length === 0) {
    return { query: rawQuery, hits: [], highlight: null, concepts: [], corrections, layoutFixed: null, partial: false };
  }

  // 4. Оценка
  const total = Math.max(index.docs.length, 1);
  const idf = (word: string, typing: boolean) => {
    const { docs } = matchStem(word, typing);
    return Math.log(1 + total / (1 + docs.size)) / Math.log(1 + total);
  };

  const altCache = new Map<Alt, Map<number, AltMatch>>();
  const scoreAlt = (alt: Alt): Map<number, AltMatch> => {
    const cached = altCache.get(alt);
    if (cached) return cached;
    const result = new Map<number, AltMatch>();
    altCache.set(alt, result);

    if (alt.ref) {
      const ref = alt.ref;
      index.docs.forEach((doc, docIndex) => {
        if (!doc.number) return;
        let score = 0;
        if (doc.number === ref) score = 6;
        else if (doc.number.startsWith(`${ref}.`)) score = alt.refPrefix ? 2.2 : 4;
        else if (!alt.refPrefix && ref.startsWith(`${doc.number}.`)) score = 2.5;
        if (score > 0) result.set(docIndex, { score: score * alt.weight, bits: BIT.number });
      });
      return result;
    }

    const perStem = alt.stems.map((word) => ({ matches: matchStem(word, Boolean(alt.typing)), idf: idf(word, Boolean(alt.typing)) }));
    if (perStem.length === 0 || perStem.some((item) => item.matches.docs.size === 0)) return result;

    const [first, ...rest] = perStem;
    for (const [docIndex, firstBits] of first.matches.docs) {
      let sum = bitsWeight(firstBits) * first.idf;
      let common = firstBits;
      let ok = true;
      for (const item of rest) {
        const bits = item.matches.docs.get(docIndex);
        if (bits === undefined) {
          ok = false;
          break;
        }
        sum += bitsWeight(bits) * item.idf;
        common &= bits;
      }
      if (!ok) continue;
      let score = (sum / perStem.length) * alt.weight;
      if (perStem.length > 1 && common !== 0) score *= 1.15;
      result.set(docIndex, { score, bits: firstBits });
    }
    return result;
  };

  type Combined = { score: number; matched: number; bits: number; via: Set<string> };
  const combined = new Map<number, Combined>();
  const altsUsedByDoc: { alt: Alt; docs: Map<number, AltMatch> }[] = [];

  for (const group of groups) {
    const best = new Map<number, { score: number; bits: number; concept?: string; weight: number }>();
    for (const alt of group.alts) {
      const matches = scoreAlt(alt);
      altsUsedByDoc.push({ alt, docs: matches });
      for (const [docIndex, match] of matches) {
        const current = best.get(docIndex);
        if (!current || match.score > current.score) {
          best.set(docIndex, { ...match, concept: alt.weight < 1 ? alt.concept : undefined, weight: alt.weight });
        }
      }
    }
    for (const [docIndex, match] of best) {
      const entry = combined.get(docIndex) ?? { score: 0, matched: 0, bits: 0, via: new Set<string>() };
      entry.score += match.score;
      entry.matched += 1;
      entry.bits |= match.bits;
      if (match.concept) entry.via.add(match.concept);
      combined.set(docIndex, entry);
    }
  }

  const groupCount = groups.length;
  let selected = [...combined.entries()].filter(([, entry]) => entry.matched === groupCount);
  let partial = false;
  if (selected.length === 0 && groupCount >= 2) {
    const need = groupCount <= 3 ? groupCount - 1 : Math.ceil(groupCount * 0.6);
    selected = [...combined.entries()]
      .filter(([, entry]) => entry.matched >= need)
      .map(([docIndex, entry]): [number, Combined] => [
        docIndex,
        { ...entry, score: entry.score * (entry.matched / groupCount) },
      ]);
    partial = selected.length > 0;
  }

  const hits: SmartHit[] = selected
    .map(([docIndex, entry]) => {
      const doc = index.docs[docIndex];
      const brevity = 1 + 0.2 * (200 / (200 + doc.text.length));
      return {
        doc,
        index: docIndex,
        score: entry.score * brevity,
        where: fieldsFromBits(entry.bits),
        via: [...entry.via],
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, partial ? 40 : 400);

  // 5. Подсветка и распознанные ситуации
  const shown = new Set(hits.map((hit) => hit.index));
  const highlightStems = new Set<string>();
  const usedConcepts = new Set<string>();
  for (const { alt, docs } of altsUsedByDoc) {
    let any = false;
    for (const docIndex of docs.keys()) {
      if (shown.has(docIndex)) {
        any = true;
        break;
      }
    }
    if (!any) continue;
    for (const word of alt.stems) highlightStems.add(word);
    if (alt.concept) usedConcepts.add(alt.concept);
  }

  return {
    query: rawQuery,
    hits,
    highlight: buildHighlight([...highlightStems]),
    concepts: triggered.filter((item) => usedConcepts.has(item.id) && !silentConcepts.has(item.id)),
    corrections,
    layoutFixed: null,
    partial,
  };
}

function fieldsFromBits(bits: number): SmartField[] {
  const fields: SmartField[] = [];
  if (bits & (BIT.tag | BIT.number)) fields.push("number");
  if (bits & BIT.text) fields.push("text");
  if (bits & BIT.punishment) fields.push("punishment");
  if (bits & BIT.note) fields.push("note");
  if (bits & BIT.section) fields.push("section");
  if (bits & BIT.article) fields.push("article");
  return fields;
}

// ——— Подсветка ———

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Регулярное выражение для подсветки: слово целиком, если оно начинается с найденной основы.
 * «ё» в тексте подсвечивается так же, как «е». Короткие основы (до 4 символов) подсвечиваются только целым словом.
 */
export function buildHighlight(stems: string[]): RegExp | null {
  const usable = [...new Set(stems.filter((word) => word.length > 0 && !REF.test(word)))].sort(
    (a, b) => b.length - a.length,
  );
  if (usable.length === 0) return null;

  const part = (word: string) => escapeRegExp(word).replaceAll("е", "[её]");
  const long = usable.filter((word) => word.length >= 4).map(part);
  const short = usable.filter((word) => word.length < 4).map(part);
  const branches: string[] = [];
  if (long.length > 0) branches.push(`(?:${long.join("|")})[\\p{L}\\p{N}]*`);
  if (short.length > 0) branches.push(`(?:${short.join("|")})(?![\\p{L}\\p{N}])`);

  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${branches.join("|")})`, "giu");
}

/** Находит в тексте строку, где есть подсвеченное слово, и обрезает вокруг неё (для показа «найдено в примечании»). */
export function excerptAround(text: string, regex: RegExp | null, radius = 110): string | null {
  if (!regex) return null;
  const match = new RegExp(regex.source, regex.flags.replace("g", "")).exec(text);
  if (!match) return null;
  const start = Math.max(0, match.index - radius);
  const end = Math.min(text.length, match.index + match[0].length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** Первое примечание пункта, в котором есть найденное слово. */
export function findNoteMatch(doc: SmartDoc, regex: RegExp | null): { label: string; excerpt: string } | null {
  if (!regex) return null;
  for (const note of doc.notes) {
    const excerpt = excerptAround(note.text, regex);
    if (excerpt) return { label: note.label, excerpt };
  }
  return null;
}

// ——— Публичный интерфейс ———

const EMPTY: SmartResult = {
  query: "",
  hits: [],
  highlight: null,
  concepts: [],
  corrections: [],
  layoutFixed: null,
  partial: false,
};

/** Строит поисковик по пунктам. Индекс создаётся один раз; сам поиск быстрый и подходит для набора на лету. */
export function createRuleSearcher(docs: SmartDoc[]): RuleSearcher {
  const index = buildIndex(docs);

  return {
    search(query: string): SmartResult {
      const trimmed = query.trim();
      if (!trimmed) return EMPTY;

      const direct = runSearch(index, query);
      if (direct.hits.length > 0) return direct;

      // Ничего не нашлось: возможно, запрос набран не в той раскладке
      const swapped = swapLayout(trimmed);
      if (swapped !== trimmed.toLowerCase()) {
        const retry = runSearch(index, swapped);
        if (retry.hits.length > 0) return { ...retry, query, layoutFixed: swapped };
      }
      return direct;
    },
  };
}

/** Все ли значимые слова запроса есть в тексте (с учётом окончаний). Для коротких списков: названий разделов и т. п. */
export function textMatchesQuery(haystack: string, query: string): boolean {
  const wanted = tokenize(prepareQuery(query)).filter((token) => !token.stop);
  if (wanted.length === 0) return true;
  const available = tokenize(haystack).map((token) => token.stem);
  const typingEnds = !/\s$/.test(query);
  return wanted.every((token, position) =>
    available.some((word) => stemsMatch(token.stem, word, typingEnds && position === wanted.length - 1)),
  );
}
