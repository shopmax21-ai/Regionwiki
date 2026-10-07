/**
 * Чтение форума Region (XenForo): список тем раздела и текст первого сообщения темы.
 *
 * Первое сообщение темы — это и есть текст правил. Ответы (в том числе «Изменения от ...» от администрации)
 * игнорируются: историю изменений сайт считает сам, сравнивая версии текста.
 */

const USER_AGENT = "RegionWikiSync/1.0";
const TIMEOUT_MS = 20_000;

export class ForumError extends Error {}

export async function fetchForumHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: { "User-Agent": USER_AGENT, Accept: "text/html", "Accept-Language": "ru,en;q=0.8" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new ForumError(`HTTP ${response.status} при загрузке ${url}`);
  return response.text();
}

/** Ссылки вида /threads/<slug>.<id>/ со страницы раздела. Ключ — slug темы (он совпадает со slug правил на сайте). */
export function discoverThreads(listingHtml: string, origin: string): Map<string, string> {
  const threads = new Map<string, string>();
  for (const match of listingHtml.matchAll(/\/threads\/([a-z0-9-]+)\.(\d+)\//gi)) {
    const [, slug, id] = match;
    if (!threads.has(slug)) threads.set(slug, `${origin}/threads/${slug}.${id}/`);
  }
  return threads;
}

type Block = { start: number; inner: string; end: number };

/** Находит парный </div> для открывающего <div ...>, который начинается в позиции openStart. */
function balancedDiv(html: string, openStart: number): Block | null {
  const tag = /<(\/?)div\b[^>]*>/gi;
  tag.lastIndex = openStart;
  let depth = 0;
  let contentStart = -1;
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    if (!match[1]) {
      depth += 1;
      if (depth === 1) contentStart = match.index + match[0].length;
    } else {
      depth -= 1;
      if (depth === 0)
        return { start: openStart, inner: html.slice(contentStart, match.index), end: match.index + match[0].length };
    }
  }
  return null;
}

function firstDivByClass(html: string, className: RegExp): Block | null {
  const open = new RegExp(`<div\\b[^>]*class="[^"]*(?:${className.source})[^"]*"[^>]*>`, "i");
  const match = open.exec(html);
  return match ? balancedDiv(html, match.index) : null;
}

/** Вырезает блоки целиком (спойлеры, цитаты): внутри них картинки и подписи, которые правилами не являются. */
function removeDivs(html: string, className: RegExp): string {
  let result = html;
  for (let guard = 0; guard < 200; guard += 1) {
    const open = new RegExp(`<div\\b[^>]*class="[^"]*(?:${className.source})[^"]*"[^>]*>`, "i").exec(result);
    if (!open) break;
    const block = balancedDiv(result, open.index);
    result = block ? result.slice(0, block.start) + result.slice(block.end) : result.slice(0, open.index);
  }
  return result;
}

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  laquo: "«",
  raquo: "»",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, body: string) => {
    if (body.startsWith("#")) {
      const code =
        body[1].toLowerCase() === "x" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    return ENTITIES[body.toLowerCase()] ?? full;
  });
}

/** Конец списка: даёт перенос строки, но не пустую строку (после вложенных списков закрывающих тегов несколько подряд). */
const SOFT_BREAK = "\u0003";
const BOLD_OPEN = "\u0001";
const BOLD_CLOSE = "\u0002";

const RULE_NUMBER = /^\d+(?:\.\d+)+\s/;
const RULE_START = /^\d+(?:\.\d+)+\s+/;

/** Блок перед пустой строкой, которой заканчивается out, начинается с номера пункта. */
function previousBlockIsRule(out: string[]): boolean {
  let end = out.length - 1;
  while (end >= 0 && out[end] === "") end -= 1;
  if (end < 0) return false;
  let start = end;
  while (start > 0 && out[start - 1] !== "") start -= 1;
  return RULE_START.test(out[start]);
}

/**
 * Превращает HTML сообщения форума в текст в формате rules/_content/*.ts:
 * жирная строка → «## Раздел», <br> → перенос строки, <li> → «- пункт», пустая строка завершает пункт.
 */
export function htmlToRulesText(html: string): string {
  // Переводы строк в исходном коде HTML ничего не значат (XenForo ставит их после каждого <br />): настоящие разрывы дают только теги.
  let text = html
    .replace(/\r?\n|\t/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, "");
  text = removeDivs(text, /bbCodeSpoiler|bbCodeBlock/);
  text = text
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<(?:b|strong)\b[^>]*>/gi, BOLD_OPEN)
    .replace(/<\/(?:b|strong)>/gi, BOLD_CLOSE)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<(?:ul|ol)\b[^>]*>/gi, "")
    .replace(/<\/(?:ul|ol)>/gi, SOFT_BREAK)
    .replace(/<\/(?:p|div|blockquote|h[1-6]|tr)>/gi, "\n")
    .replace(/<(?:p|div|blockquote|h[1-6]|tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  text = decodeEntities(text)
    .replace(new RegExp(`(?:${SOFT_BREAK} *)+\\n?`, "g"), "\n")
    // biome-ignore lint/suspicious/noMisleadingCharacterClass: ZWJ входит в набор удаляемых невидимых символов
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\u00a0/g, " ");

  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/[ \t]+/g, " ").trim();
    if (!line) {
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      continue;
    }

    const plain = line
      // biome-ignore lint/suspicious/noControlCharactersInRegex: \u0001 и \u0002 — служебные маркеры жирного текста
      .replace(/[\u0001\u0002]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!plain || /^Спойлер\s*:/i.test(plain)) continue;

    // Строка целиком жирная и не начинается с номера пункта — это заголовок раздела.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: \u0001 и \u0002 — служебные маркеры жирного текста
    const withoutBold = line.replace(/\u0001[^\u0002]*\u0002/g, "").trim();
    if (withoutBold === "" && !RULE_NUMBER.test(`${plain} `)) {
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      out.push(`## ${plain.replace(/:$/, "")}`);
      continue;
    }

    const normalized = plain
      .replace(/^(Примечание|Пояснение|Разъяснение|Пример|Исключение)\s+(\d+)\s*[:.)]\s*/i, "$1: $2) ")
      .replace(/(\d)-(\d)/g, "$1 - $2");

    // Список, отделённый от пункта пустой строкой, всё равно относится к этому пункту.
    if (normalized.startsWith("- ") && out[out.length - 1] === "" && previousBlockIsRule(out)) out.pop();
    out.push(normalized);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Текст правил из первого сообщения темы. Бросает ForumError, если разметка не похожа на тему форума. */
export function extractRulesText(threadHtml: string): string {
  const post = firstDivByClass(threadHtml, /bbWrapper/);
  if (!post)
    throw new ForumError(
      "В теме не найден текст первого сообщения (блок bbWrapper). Возможно, форум изменил разметку или требует вход.",
    );
  const text = htmlToRulesText(post.inner);
  if (!text) throw new ForumError("Первое сообщение темы пустое.");
  return text;
}
