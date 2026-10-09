/**
 * Поиск названия проекта в тексте стрима: заголовке, имени канала, тегах.
 *
 * Название пишут по-разному, поэтому текст и ключевые слова приводятся к одному виду:
 *  - регистр, диакритика, «математические» и полноширинные буквы (𝐑𝐄𝐆𝐈𝐎𝐍, ＲＥＧＩＯＮ);
 *  - кириллица транслитерируется в латиницу: «Регион» и «Region» дают один и тот же ключ;
 *  - смешанные алфавиты в одном слове («Рegion», «pегион», «Regиoн») чинятся по похожим буквам;
 *  - цифры вместо букв внутри слова («R3gion», «Regi0n»);
 *  - любые разделители: «Region RP», «region_rp», «region.game», «REGION|RP», «[REGION]», «R E G I O N»;
 *  - слитные приставки и окончания: «RegionRP», «RegionTV», «Region5».
 * Склонения и однокоренные слова («регионе», «regional», «regions») намеренно не считаются совпадением.
 */

const CYRILLIC_TO_LATIN: Readonly<Record<string, string>> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  і: "i",
  ї: "i",
  є: "e",
  ґ: "g",
};

/** Латинские буквы, неотличимые на глаз от кириллических: нужны, когда в слове смешаны оба алфавита. */
const LATIN_LOOKALIKES: Readonly<Record<string, string>> = {
  a: "а",
  b: "в",
  c: "с",
  e: "е",
  h: "н",
  k: "к",
  m: "м",
  o: "о",
  p: "р",
  t: "т",
  x: "х",
  y: "у",
};

const LEET: Readonly<Record<string, string>> = { "0": "o", "1": "i", "3": "e" };

/** Слитные приставки к названию: «RegionRP», «RegionTV». Через пробел они и так не мешают. */
const GLUED_SUFFIXES = [
  "rp",
  "rpg",
  "roleplay",
  "game",
  "gta",
  "gta5",
  "gtav",
  "gta5rp",
  "5rp",
  "help",
  "wiki",
  "ru",
  "tv",
  "official",
  "stream",
];

/** Названия по умолчанию. Дополнительные задаются переменной MEDIA_TWITCH_KEYWORDS. */
export const DEFAULT_KEYWORDS: readonly string[] = ["region", "регион", "реджион", "риджион", "ригион"];

const CYRILLIC = /[\u0400-\u04FF]/u;
const LATIN = /[a-z]/u;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function transliterateWord(word: string): string {
  let result = word;
  if (CYRILLIC.test(result) && LATIN.test(result)) {
    result = Array.from(result, (char) => LATIN_LOOKALIKES[char] ?? char).join("");
  }
  return Array.from(result, (char) => CYRILLIC_TO_LATIN[char] ?? char).join("");
}

/** «R E G I O N» и «R.E.G.I.O.N» → «REGION»: подряд идущие одиночные буквы склеиваются. */
function mergeSpelledOut(words: string[]): string[] {
  const merged: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 3) merged.push(run.join(""));
    else merged.push(...run);
    run = [];
  };
  for (const word of words) {
    if (Array.from(word).length === 1 && /\p{L}/u.test(word)) run.push(word);
    else {
      flush();
      merged.push(word);
    }
  }
  flush();
  return merged;
}

/** Приводит текст к ключу: латиница в нижнем регистре, слова через один пробел. */
export function toMatchKey(text: string, options: { leet?: boolean } = {}): string {
  const base = text.normalize("NFKC").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const words = base.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const prepared = options.leet
    ? words.map((word) => word.replace(/(?<=\p{L})[013](?=\p{L})/gu, (digit) => LEET[digit] ?? digit))
    : words;
  return mergeSpelledOut(prepared).map(transliterateWord).join(" ");
}

function buildPattern(keyword: string): RegExp | null {
  const tokens = toMatchKey(keyword).split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  const body = tokens.map(escapeRegExp).join("\\s?");
  const suffixes = GLUED_SUFFIXES.map(escapeRegExp).join("|");
  // Слева — не буква и не цифра; справа — не буква (цифры допустимы: «Region5»), либо известная слитная приставка.
  return new RegExp(`(?<![a-z0-9])${body}(?:(?:${suffixes})(?![a-z]))?(?![a-z])`, "u");
}

export type NameMatcher = (fields: ReadonlyArray<string | null | undefined>) => boolean;

/** Возвращает проверку «встречается ли название хотя бы в одном из полей». Каждое поле проверяется отдельно. */
export function createNameMatcher(keywords: readonly string[]): NameMatcher {
  const patterns = [...new Set(keywords)]
    .map((keyword) => buildPattern(keyword))
    .filter((pattern): pattern is RegExp => pattern !== null);

  return (fields) => {
    for (const field of fields) {
      if (!field) continue;
      const keys = [toMatchKey(field), toMatchKey(field, { leet: true })];
      for (const pattern of patterns) {
        if (keys.some((key) => pattern.test(key))) return true;
      }
    }
    return false;
  };
}
