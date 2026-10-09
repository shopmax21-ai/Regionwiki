import { createNameMatcher, DEFAULT_KEYWORDS } from "./name-match";
import type { MediaResponse, MediaStream } from "./types";

/**
 * Поиск трансляций проекта на Twitch. Работает только на сервере: ключи приложения в браузер не попадают.
 *
 * Как ищем:
 *  1. просматриваем живые трансляции нужных категорий (по умолчанию GTA V) и оставляем те, где название проекта
 *     встречается в заголовке, имени канала или тегах;
 *  2. отдельно ищем каналы по каждому варианту названия, чтобы поймать стримеров из других категорий;
 *  3. объединяем, убираем исключённых и подтягиваем аватарки.
 * Результат живёт в памяти процесса минуту, поэтому нагрузка на Twitch не зависит от числа посетителей.
 */

const CLIENT_ID = process.env.TWITCH_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET?.trim();

const HELIX = "https://api.twitch.tv/helix";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

const RESULT_TTL_MS = 60_000;
const ERROR_RETRY_MS = 15_000;
const AVATAR_TTL_MS = 6 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
/** Страниц по 100 трансляций на категорию: этого хватает и для вечернего пика. */
const MAX_CATEGORY_PAGES = 20;
const MAX_SEARCH_PAGES = 2;
const GTA_V_GAME_ID = "32982";

const list = (value: string | undefined): string[] =>
  (value ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const KEYWORDS = [...new Set([...DEFAULT_KEYWORDS, ...list(process.env.MEDIA_TWITCH_KEYWORDS)])];
const GAME_IDS = list(process.env.MEDIA_TWITCH_GAME_IDS ?? GTA_V_GAME_ID);
// Пустое значение отключает фильтр по языку: тогда просматриваются трансляции на всех языках.
const LANGUAGES = list(process.env.MEDIA_TWITCH_LANGUAGES ?? "ru");
const EXCLUDED_LOGINS = new Set(list(process.env.MEDIA_TWITCH_EXCLUDE).map((login) => login.toLowerCase()));

const matchesName = createNameMatcher(KEYWORDS);

export const isTwitchConfigured = () => Boolean(CLIENT_ID && CLIENT_SECRET);

type HelixStream = {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  tags?: string[] | null;
};

type HelixChannel = {
  id: string;
  broadcaster_login: string;
  display_name: string;
  is_live: boolean;
  title: string;
  tags?: string[] | null;
};

type HelixUser = { id: string; profile_image_url: string };

type HelixPage<T> = { data: T[]; pagination?: { cursor?: string } };

class TwitchError extends Error {}

// --- Токен приложения (client credentials): живёт около двух месяцев, обновляем заранее ---

let token: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

async function requestToken(): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      grant_type: "client_credentials",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new TwitchError(`Не удалось получить токен Twitch (${response.status})`);
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new TwitchError("Twitch не вернул токен");
  token = { value: data.access_token, expiresAt: Date.now() + Math.max((data.expires_in ?? 3600) - 300, 60) * 1000 };
  return data.access_token;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && token && token.expiresAt > Date.now()) return token.value;
  tokenRequest ??= requestToken().finally(() => {
    tokenRequest = null;
  });
  return tokenRequest;
}

async function helix<T>(path: string, params: URLSearchParams): Promise<HelixPage<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${HELIX}/${path}?${params}`, {
      headers: { "Client-Id": CLIENT_ID ?? "", Authorization: `Bearer ${await getToken(attempt > 0)}` },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // Токен мог быть отозван раньше срока: один раз берём новый и повторяем запрос.
    if (response.status === 401 && attempt === 0) continue;
    if (!response.ok) throw new TwitchError(`Twitch ответил ${response.status} на /${path}`);
    return (await response.json()) as HelixPage<T>;
  }
  throw new TwitchError("Twitch отклонил токен");
}

/** Все страницы ответа с курсором, но не больше maxPages. */
async function helixAll<T>(path: string, params: URLSearchParams, maxPages: number): Promise<T[]> {
  const result: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const query = new URLSearchParams(params);
    if (cursor) query.set("after", cursor);
    const data = await helix<T>(path, query);
    result.push(...data.data);
    cursor = data.pagination?.cursor;
    if (!cursor || data.data.length === 0) break;
  }
  return result;
}

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

// --- Поиск трансляций ---

const streamFields = (stream: HelixStream) => [
  stream.title,
  stream.user_name,
  stream.user_login,
  ...(stream.tags ?? []),
];

async function scanCategory(gameId: string): Promise<HelixStream[]> {
  const params = new URLSearchParams({ game_id: gameId, type: "live", first: "100" });
  for (const language of LANGUAGES) params.append("language", language);
  const streams = await helixAll<HelixStream>("streams", params, MAX_CATEGORY_PAGES);
  return streams.filter((stream) => matchesName(streamFields(stream)));
}

async function searchChannels(keyword: string): Promise<HelixChannel[]> {
  const params = new URLSearchParams({ query: keyword, live_only: "true", first: "100" });
  const channels = await helixAll<HelixChannel>("search/channels", params, MAX_SEARCH_PAGES);
  return channels.filter(
    (channel) =>
      channel.is_live &&
      matchesName([channel.title, channel.display_name, channel.broadcaster_login, ...(channel.tags ?? [])]),
  );
}

async function loadStreamsByUserId(userIds: string[]): Promise<HelixStream[]> {
  const pages = await Promise.all(
    chunk(userIds, 100).map((ids) => {
      const params = new URLSearchParams({ first: "100" });
      for (const id of ids) params.append("user_id", id);
      return helix<HelixStream>("streams", params);
    }),
  );
  return pages.flatMap((page) => page.data).filter((stream) => stream.type === "live");
}

// --- Аватарки: меняются редко, поэтому хранятся дольше самих трансляций ---

const avatars = new Map<string, { url: string; expiresAt: number }>();

async function loadAvatars(userIds: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const result = new Map<string, string>();
  const missing: string[] = [];
  for (const id of userIds) {
    const cached = avatars.get(id);
    if (cached && cached.expiresAt > now) result.set(id, cached.url);
    else missing.push(id);
  }

  const pages = await Promise.allSettled(
    chunk(missing, 100).map((ids) => {
      const params = new URLSearchParams();
      for (const id of ids) params.append("id", id);
      return helix<HelixUser>("users", params);
    }),
  );
  // Без аватарок страница всё равно работает: покажутся инициалы.
  for (const page of pages) {
    if (page.status !== "fulfilled") continue;
    for (const user of page.value.data) {
      avatars.set(user.id, { url: user.profile_image_url, expiresAt: now + AVATAR_TTL_MS });
      result.set(user.id, user.profile_image_url);
    }
  }
  return result;
}

async function loadStreams(): Promise<MediaStream[]> {
  const [categoryResults, searchResults] = await Promise.all([
    Promise.all(GAME_IDS.map((gameId) => scanCategory(gameId))),
    Promise.allSettled(KEYWORDS.map((keyword) => searchChannels(keyword))),
  ]);

  const found = new Map<string, HelixStream>();
  for (const stream of categoryResults.flat()) found.set(stream.user_id, stream);

  // Каналы из поиска, которых не было в категориях: у них нет числа зрителей, поэтому запрашиваем трансляции отдельно.
  const extraIds = new Set<string>();
  for (const result of searchResults) {
    if (result.status !== "fulfilled") continue;
    for (const channel of result.value) if (!found.has(channel.id)) extraIds.add(channel.id);
  }
  if (extraIds.size > 0) {
    for (const stream of await loadStreamsByUserId([...extraIds])) found.set(stream.user_id, stream);
  }

  const visible = [...found.values()].filter((stream) => !EXCLUDED_LOGINS.has(stream.user_login.toLowerCase()));
  const avatarByUser = await loadAvatars(visible.map((stream) => stream.user_id));

  return visible
    .map(
      (stream): MediaStream => ({
        id: stream.id,
        login: stream.user_login,
        name: stream.user_name || stream.user_login,
        title: stream.title.trim(),
        game: stream.game_name,
        language: stream.language,
        viewers: stream.viewer_count,
        startedAt: stream.started_at,
        avatar: avatarByUser.get(stream.user_id) ?? null,
        url: `https://www.twitch.tv/${stream.user_login}`,
      }),
    )
    .sort((a, b) => b.viewers - a.viewers || a.name.localeCompare(b.name));
}

// --- Кэш в памяти: один запрос к Twitch в минуту независимо от числа посетителей ---

let cache: { at: number; value: MediaResponse } | null = null;
let inflight: Promise<MediaResponse> | null = null;
let retryAfter = 0;

async function refresh(): Promise<MediaResponse> {
  const streams = await loadStreams();
  const value: MediaResponse = { status: "ok", streams, updatedAt: new Date().toISOString() };
  cache = { at: Date.now(), value };
  retryAfter = 0;
  return value;
}

export async function getMediaStreams(): Promise<MediaResponse> {
  if (!isTwitchConfigured()) return { status: "unconfigured", streams: [], updatedAt: null };
  if (cache && Date.now() - cache.at < RESULT_TTL_MS) return cache.value;

  // После сбоя несколько секунд не долбим Twitch повторно: отдаём прошлый результат или ошибку.
  if (Date.now() < retryAfter) {
    return cache ? { ...cache.value, stale: true } : { status: "error", streams: [], updatedAt: null };
  }

  inflight ??= refresh().finally(() => {
    inflight = null;
  });
  try {
    return await inflight;
  } catch (error) {
    console.error("[media] не удалось загрузить трансляции Twitch:", error instanceof Error ? error.message : error);
    retryAfter = Date.now() + ERROR_RETRY_MS;
    return cache ? { ...cache.value, stale: true } : { status: "error", streams: [], updatedAt: null };
  }
}
