import { listChannels } from "./channels";
import { createNameMatcher, DEFAULT_KEYWORDS } from "./name-match";
import type { MediaResponse, MediaStream, TrackedChannel } from "./types";

/**
 * Поиск трансляций проекта на Twitch. Работает только на сервере: ключи приложения в браузер не попадают.
 *
 * Как ищем:
 *  1. просматриваем живые трансляции нужных категорий (по умолчанию GTA V) и оставляем те, где название проекта
 *     встречается в заголовке, имени канала или тегах;
 *  2. отдельно ищем каналы по каждому варианту названия, чтобы поймать стримеров из других категорий;
 *  3. добавляем каналы из списка отслеживаемых (таблица media_channels): они показываются, когда в эфире,
 *     независимо от названия и категории;
 *  4. объединяем, убираем исключённых и подтягиваем аватарки.
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

type HelixUser = { id: string; login?: string; display_name?: string; profile_image_url: string };

type HelixPage<T> = { data: T[]; pagination?: { cursor?: string } };

/** auth — Twitch не принял ключи приложения; network — сервер не достучался до Twitch; http — Twitch ответил ошибкой */
export class TwitchError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "network" | "http" = "http",
  ) {
    super(message);
  }
}

/** Понятная причина сбоя для администрации. Секреты в текст не попадают. */
export function describeTwitchError(error: unknown): string {
  if (error instanceof TwitchError) return error.message;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "Twitch не ответил за 8 секунд. Сервер не может подключиться к api.twitch.tv.";
  }
  if (error instanceof TypeError) return "Сервер не может подключиться к Twitch (нет сети или адрес заблокирован).";
  return "Неизвестная ошибка при обращении к Twitch.";
}

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
  if (!response.ok) {
    const auth = response.status === 400 || response.status === 401 || response.status === 403;
    throw new TwitchError(
      auth
        ? `Twitch не принял ключи приложения (код ${response.status}). Проверьте TWITCH_CLIENT_ID и TWITCH_CLIENT_SECRET: ключи должны быть из одного приложения на dev.twitch.tv/console.`
        : `Не удалось получить токен Twitch (код ${response.status}).`,
      auth ? "auth" : "http",
    );
  }
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new TwitchError("Twitch не вернул токен.");
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
    if (!response.ok) throw new TwitchError(`Twitch ответил кодом ${response.status} на запрос /${path}.`);
    return (await response.json()) as HelixPage<T>;
  }
  throw new TwitchError("Twitch отклонил токен приложения.", "auth");
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

/** Трансляции указанных каналов, которые сейчас в эфире. Работает и для тех, у кого в заголовке нет названия проекта. */
export async function fetchStreamsByLogins(logins: string[]): Promise<HelixStream[]> {
  if (logins.length === 0) return [];
  const pages = await Promise.all(
    chunk(logins, 100).map((items) => {
      const params = new URLSearchParams({ first: "100", type: "live" });
      for (const login of items) params.append("user_login", login);
      return helix<HelixStream>("streams", params);
    }),
  );
  return pages.flatMap((page) => page.data).filter((stream) => stream.type === "live");
}

export type TwitchChannelInfo = { id: string; login: string; name: string };

/** Проверяет, что канал существует. null, если такого логина на Twitch нет. */
export async function lookupTwitchChannel(login: string): Promise<TwitchChannelInfo | null> {
  const data = await helix<HelixUser>("users", new URLSearchParams({ login }));
  const user = data.data[0];
  if (!user?.login) return null;
  return { id: user.id, login: user.login.toLowerCase(), name: user.display_name || user.login };
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

/** Список отслеживаемых каналов. Если база недоступна, раздел работает без него. */
async function safeChannels(): Promise<TrackedChannel[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    return await listChannels();
  } catch (error) {
    console.error("[media] не удалось прочитать список каналов:", error instanceof Error ? error.message : error);
    return [];
  }
}

async function loadStreams(channels: TrackedChannel[]): Promise<MediaStream[]> {
  const trackedLogins = new Set(channels.map((channel) => channel.login));
  const [categoryResults, searchResults, trackedStreams] = await Promise.all([
    Promise.all(GAME_IDS.map((gameId) => scanCategory(gameId).catch(() => [] as HelixStream[]))),
    Promise.allSettled(KEYWORDS.map((keyword) => searchChannels(keyword))),
    fetchStreamsByLogins(channels.map((channel) => channel.login)),
  ]);

  const found = new Map<string, HelixStream>();
  for (const stream of categoryResults.flat()) found.set(stream.user_id, stream);

  for (const stream of trackedStreams) found.set(stream.user_id, stream);

  // Каналы из поиска, которых не было в категориях: у них нет числа зрителей, поэтому запрашиваем трансляции отдельно.
  const extraIds = new Set<string>();
  for (const result of searchResults) {
    if (result.status !== "fulfilled") continue;
    for (const channel of result.value) if (!found.has(channel.id)) extraIds.add(channel.id);
  }
  if (extraIds.size > 0) {
    for (const stream of await loadStreamsByUserId([...extraIds])) found.set(stream.user_id, stream);
  }

  const visible = [...found.values()].filter(
    (stream) =>
      trackedLogins.has(stream.user_login.toLowerCase()) || !EXCLUDED_LOGINS.has(stream.user_login.toLowerCase()),
  );
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
        tracked: trackedLogins.has(stream.user_login.toLowerCase()),
      }),
    )
    .sort((a, b) => Number(b.tracked) - Number(a.tracked) || b.viewers - a.viewers || a.name.localeCompare(b.name));
}

// --- Кэш в памяти: один запрос к Twitch в минуту независимо от числа посетителей ---

/**
 * Кэш хранит только ответ Twitch. Список каналов читается из базы при каждом запросе (это быстро), поэтому правки
 * списка видны сразу. Если набор каналов изменился, кэш считается устаревшим: так не нужно сбрасывать его
 * из серверных действий (у них может быть своя копия модуля).
 */
let cache: { at: number; signature: string; value: MediaResponse } | null = null;
let inflight: { signature: string; promise: Promise<MediaResponse> } | null = null;
let retryAfter = 0;
let lastProblem: string | undefined;

const signatureOf = (channels: TrackedChannel[]) =>
  channels
    .map((channel) => channel.login)
    .sort()
    .join(",");

/** Сбросить кэш: после правки списка каналов страница должна показать изменения сразу. */
export function invalidateMediaCache(): void {
  cache = null;
  retryAfter = 0;
}

async function refresh(channels: TrackedChannel[]): Promise<MediaResponse> {
  const streams = await loadStreams(channels);
  const value: MediaResponse = { status: "ok", streams, channels, updatedAt: new Date().toISOString() };
  cache = { at: Date.now(), signature: signatureOf(channels), value };
  retryAfter = 0;
  lastProblem = undefined;
  return value;
}

export async function getMediaStreams(): Promise<MediaResponse> {
  const channels = await safeChannels();
  if (!isTwitchConfigured()) return { status: "unconfigured", streams: [], channels, updatedAt: null };

  const signature = signatureOf(channels);
  if (cache && cache.signature === signature && Date.now() - cache.at < RESULT_TTL_MS) {
    return { ...cache.value, channels };
  }

  // После сбоя несколько секунд не долбим Twitch повторно: отдаём прошлый результат или ошибку.
  // Правка списка каналов (другой набор) это ожидание отменяет.
  const sameSet = cache?.signature === signature;
  if (Date.now() < retryAfter && (sameSet || !cache)) {
    return cache
      ? { ...cache.value, channels, stale: true }
      : { status: "error", streams: [], channels, updatedAt: null, problem: lastProblem };
  }

  if (inflight?.signature !== signature) {
    const promise = refresh(channels).finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
    inflight = { signature, promise };
  }
  try {
    return await inflight.promise;
  } catch (error) {
    console.error("[media] не удалось загрузить трансляции Twitch:", error instanceof Error ? error.message : error);
    lastProblem = describeTwitchError(error);
    retryAfter = Date.now() + ERROR_RETRY_MS;
    return cache
      ? { ...cache.value, channels, stale: true }
      : { status: "error", streams: [], channels, updatedAt: null, problem: lastProblem };
  }
}
