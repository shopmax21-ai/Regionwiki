import { isYoutubeChannelId } from "./channels";
import type { MediaStream, TrackedChannel } from "./types";

/**
 * Поиск идущих трансляций на YouTube у каналов из списка отслеживаемых. Работает только на сервере: ключ в браузер не попадает.
 *
 * Как проверяем (так, чтобы почти не тратить квоту YouTube Data API, 10 000 единиц в сутки):
 *  1. у каждого канала берём последние видео из публичной RSS-ленты (она бесплатная и не входит в квоту);
 *     если лента не отвечает, берём плейлист загрузок канала (1 единица за канал);
 *  2. одним запросом videos.list (1 единица на 50 видео) узнаём, какие из них сейчас идут в эфире;
 *  3. подтягиваем аватарки каналов одним запросом и храним их несколько часов.
 * Результат живёт в памяти процесса минуту, поэтому нагрузка не зависит от числа посетителей.
 */

const API_KEY = process.env.YOUTUBE_API_KEY?.trim();
const API = "https://www.googleapis.com/youtube/v3";
const FEED = "https://www.youtube.com/feeds/videos.xml";

const RESULT_TTL_MS = 60_000;
const ERROR_RETRY_MS = 30_000;
const AVATAR_TTL_MS = 6 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
/** Сколько последних видео канала проверять: эфир всегда среди самых свежих */
const RECENT_VIDEOS = 6;

export const isYoutubeConfigured = () => Boolean(API_KEY);

/** auth — ключ не принят или API не включён; quota — исчерпана суточная квота; network — не достучались; http — иная ошибка */
export class YoutubeError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "quota" | "network" | "http" = "http",
  ) {
    super(message);
  }
}

/** Понятная причина сбоя для администрации. Ключ в текст не попадает. */
export function describeYoutubeError(error: unknown): string {
  if (error instanceof YoutubeError) return error.message;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "YouTube не ответил за 8 секунд. Сервер не может подключиться к googleapis.com.";
  }
  if (error instanceof TypeError) return "Сервер не может подключиться к YouTube (нет сети или адрес заблокирован).";
  return "Неизвестная ошибка при обращении к YouTube.";
}

type ApiErrorBody = { error?: { code?: number; message?: string; errors?: { reason?: string }[] } };

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ ...params, key: API_KEY ?? "" });
  const response = await fetch(`${API}/${path}?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.ok) return (await response.json()) as T;

  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  const reason = body?.error?.errors?.[0]?.reason ?? "";
  if (reason === "quotaExceeded" || reason === "rateLimitExceeded" || reason === "dailyLimitExceeded") {
    throw new YoutubeError(
      "Исчерпана суточная квота YouTube Data API. Проверка возобновится после её сброса.",
      "quota",
    );
  }
  if (reason === "keyInvalid" || response.status === 400) {
    throw new YoutubeError(
      "YouTube не принял ключ. Проверьте YOUTUBE_API_KEY: ключ создаётся в Google Cloud Console.",
      "auth",
    );
  }
  if (reason === "accessNotConfigured" || reason === "forbidden" || response.status === 403) {
    throw new YoutubeError(
      "YouTube отклонил запрос (код 403). В проекте Google Cloud должен быть включён YouTube Data API v3, а у ключа не должно быть ограничений, закрывающих сервер.",
      "auth",
    );
  }
  throw new YoutubeError(`YouTube ответил кодом ${response.status} на запрос /${path}.`);
}

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

// --- Разбор того, что ввёл администратор ---

export type YoutubeChannelQuery =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "username"; value: string };

/**
 * Принимает ID канала (UC...), @имя, а также ссылки youtube.com/channel/UC..., youtube.com/@имя, youtube.com/user/имя.
 * Ссылки старого вида youtube.com/c/имя тоже пробуем как @имя.
 */
export function parseYoutubeChannel(input: unknown): YoutubeChannelQuery | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (!text) return null;
  if (isYoutubeChannelId(text)) return { kind: "id", value: text };

  const handle = /^@?([\p{L}\p{N}._-]{3,30})$/u.exec(text);
  if (text.startsWith("@") && handle) return { kind: "handle", value: handle[1] };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!/^(www\.|m\.)?youtube\.com$/i.test(url.hostname)) return null;

  const [first, second] = url.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
  if (first?.startsWith("@") && first.length > 1) return { kind: "handle", value: first.slice(1) };
  if (first === "channel" && second && isYoutubeChannelId(second)) return { kind: "id", value: second };
  if (first === "user" && second) return { kind: "username", value: second };
  if (first === "c" && second) return { kind: "handle", value: second };
  return null;
}

export type YoutubeChannelInfo = { id: string; name: string };

type ChannelsResponse = {
  items?: { id: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }[];
};

/** Проверяет, что канал существует. null, если такого канала на YouTube нет. */
export async function lookupYoutubeChannel(query: YoutubeChannelQuery): Promise<YoutubeChannelInfo | null> {
  const params: Record<string, string> = { part: "snippet" };
  if (query.kind === "id") params.id = query.value;
  else if (query.kind === "handle") params.forHandle = `@${query.value}`;
  else params.forUsername = query.value;
  const data = await api<ChannelsResponse>("channels", params);
  const item = data.items?.[0];
  if (!item) return null;
  return { id: item.id, name: item.snippet?.title?.trim() || item.id };
}

// --- Аватарки: меняются редко, поэтому хранятся дольше самих трансляций ---

const avatars = new Map<string, { url: string; expiresAt: number }>();

async function loadAvatars(channelIds: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const result = new Map<string, string>();
  const missing: string[] = [];
  for (const id of channelIds) {
    const cached = avatars.get(id);
    if (cached && cached.expiresAt > now) result.set(id, cached.url);
    else missing.push(id);
  }
  const pages = await Promise.allSettled(
    chunk(missing, 50).map((ids) =>
      api<ChannelsResponse>("channels", { part: "snippet", id: ids.join(","), maxResults: "50" }),
    ),
  );
  // Без аватарок страница всё равно работает: покажутся инициалы.
  for (const page of pages) {
    if (page.status !== "fulfilled") continue;
    for (const item of page.value.items ?? []) {
      const url = item.snippet?.thumbnails?.default?.url;
      if (!url) continue;
      avatars.set(item.id, { url, expiresAt: now + AVATAR_TTL_MS });
      result.set(item.id, url);
    }
  }
  return result;
}

// --- Поиск эфиров ---

/** Последние видео канала из RSS-ленты. Бросает ошибку, если лента недоступна. */
async function recentFromFeed(channelId: string): Promise<string[]> {
  const response = await fetch(`${FEED}?channel_id=${encodeURIComponent(channelId)}`, {
    cache: "no-store",
    headers: { Accept: "application/atom+xml,application/xml,text/xml" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new YoutubeError(`RSS-лента канала ответила кодом ${response.status}.`);
  const xml = await response.text();
  return [...xml.matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>/g)].map((match) => match[1]).slice(0, RECENT_VIDEOS);
}

type PlaylistResponse = { items?: { contentDetails?: { videoId?: string } }[] };

/** Запасной путь: плейлист загрузок канала (его ID — это ID канала с «UU» вместо «UC»). */
async function recentFromPlaylist(channelId: string): Promise<string[]> {
  const data = await api<PlaylistResponse>("playlistItems", {
    part: "contentDetails",
    playlistId: `UU${channelId.slice(2)}`,
    maxResults: String(RECENT_VIDEOS),
  });
  return (data.items ?? []).map((item) => item.contentDetails?.videoId).filter((id): id is string => Boolean(id));
}

type VideosResponse = {
  items?: {
    id: string;
    snippet?: {
      channelId?: string;
      channelTitle?: string;
      title?: string;
      liveBroadcastContent?: string;
      defaultAudioLanguage?: string;
      defaultLanguage?: string;
    };
    liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string; concurrentViewers?: string };
  }[];
};

export type YoutubeLive = {
  videoId: string;
  channelId: string;
  channelName: string;
  title: string;
  startedAt: string;
  viewers: number;
  language: string;
};

/** Трансляции указанных каналов, которые идут прямо сейчас. */
export async function fetchYoutubeLive(channelIds: string[]): Promise<YoutubeLive[]> {
  if (channelIds.length === 0) return [];

  const perChannel = await Promise.all(
    channelIds.map(async (id) => ({
      id,
      videos: await recentFromFeed(id).catch(() => recentFromPlaylist(id)),
    })),
  );
  const videoIds = [...new Set(perChannel.flatMap((entry) => entry.videos))];
  if (videoIds.length === 0) return [];

  const pages = await Promise.all(
    chunk(videoIds, 50).map((ids) =>
      api<VideosResponse>("videos", { part: "snippet,liveStreamingDetails", id: ids.join(","), maxResults: "50" }),
    ),
  );

  const wanted = new Set(channelIds);
  const live: YoutubeLive[] = [];
  for (const item of pages.flatMap((page) => page.items ?? [])) {
    const channelId = item.snippet?.channelId;
    const details = item.liveStreamingDetails;
    // Идёт сейчас: YouTube помечает эфир «live», у него есть начало и нет конца. Анонсы и записи не подходят.
    if (!channelId || !wanted.has(channelId)) continue;
    if (item.snippet?.liveBroadcastContent !== "live" || !details?.actualStartTime || details.actualEndTime) continue;
    live.push({
      videoId: item.id,
      channelId,
      channelName: item.snippet?.channelTitle?.trim() || channelId,
      title: item.snippet?.title?.trim() ?? "",
      startedAt: details.actualStartTime,
      viewers: Number(details.concurrentViewers ?? 0) || 0,
      language: (item.snippet?.defaultAudioLanguage ?? item.snippet?.defaultLanguage ?? "").slice(0, 2),
    });
  }
  return live;
}

// --- Результат для страницы с кэшем в памяти ---

export type YoutubeStreamsResult =
  | { status: "ok"; streams: MediaStream[]; updatedAt: string; stale?: boolean }
  | { status: "unconfigured" }
  | { status: "error"; problem: string };

let cache: { at: number; signature: string; streams: MediaStream[]; updatedAt: string } | null = null;
let inflight: { signature: string; promise: Promise<MediaStream[]> } | null = null;
let retryAfter = 0;
let lastProblem = "";

const signatureOf = (channels: TrackedChannel[]) =>
  channels
    .map((channel) => channel.login)
    .sort()
    .join(",");

async function load(channels: TrackedChannel[]): Promise<MediaStream[]> {
  const live = await fetchYoutubeLive(channels.map((channel) => channel.login));
  const avatarByChannel = await loadAvatars([...new Set(live.map((stream) => stream.channelId))]).catch(
    () => new Map<string, string>(),
  );
  const byId = new Map(channels.map((channel) => [channel.login, channel]));
  return live
    .map(
      (stream): MediaStream => ({
        platform: "youtube",
        id: stream.videoId,
        login: stream.channelId,
        // Имя из списка администрации важнее названия на YouTube: так же, как у отслеживаемых каналов Twitch
        name: byId.get(stream.channelId)?.name || stream.channelName,
        title: stream.title,
        game: "",
        language: stream.language,
        viewers: stream.viewers,
        startedAt: stream.startedAt,
        avatar: avatarByChannel.get(stream.channelId) ?? null,
        url: `https://www.youtube.com/watch?v=${stream.videoId}`,
        tracked: true,
      }),
    )
    .sort((a, b) => b.viewers - a.viewers || a.name.localeCompare(b.name));
}

/** Сбросить кэш: после правки списка каналов страница должна показать изменения сразу. */
export function invalidateYoutubeCache(): void {
  cache = null;
  retryAfter = 0;
}

/** Эфиры отслеживаемых каналов YouTube. Если каналов нет, запросов к YouTube не будет вовсе. */
export async function getYoutubeStreams(channels: TrackedChannel[]): Promise<YoutubeStreamsResult> {
  if (!isYoutubeConfigured()) return { status: "unconfigured" };
  if (channels.length === 0) return { status: "ok", streams: [], updatedAt: new Date().toISOString() };

  const signature = signatureOf(channels);
  if (cache && cache.signature === signature && Date.now() - cache.at < RESULT_TTL_MS) {
    return { status: "ok", streams: cache.streams, updatedAt: cache.updatedAt };
  }
  const sameSet = cache?.signature === signature;
  if (Date.now() < retryAfter && (sameSet || !cache)) {
    return cache && sameSet
      ? { status: "ok", streams: cache.streams, updatedAt: cache.updatedAt, stale: true }
      : { status: "error", problem: lastProblem };
  }

  if (inflight?.signature !== signature) {
    const promise = load(channels).finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
    inflight = { signature, promise };
  }
  try {
    const streams = await inflight.promise;
    const updatedAt = new Date().toISOString();
    cache = { at: Date.now(), signature, streams, updatedAt };
    retryAfter = 0;
    return { status: "ok", streams, updatedAt };
  } catch (error) {
    console.error("[media] не удалось загрузить трансляции YouTube:", error instanceof Error ? error.message : error);
    lastProblem = describeYoutubeError(error);
    // Квота сбрасывается раз в сутки, долбить YouTube каждые полминуты бессмысленно
    retryAfter = Date.now() + (error instanceof YoutubeError && error.kind === "quota" ? 10 * 60_000 : ERROR_RETRY_MS);
    return cache && cache.signature === signature
      ? { status: "ok", streams: cache.streams, updatedAt: cache.updatedAt, stale: true }
      : { status: "error", problem: lastProblem };
  }
}
