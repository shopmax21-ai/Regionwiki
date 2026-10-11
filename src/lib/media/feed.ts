import { listChannels } from "./channels";
import { getMediaStreams, invalidateMediaCache as invalidateTwitchCache } from "./twitch";
import type { MediaResponse, MediaStream, TrackedChannel } from "./types";
import { getYoutubeStreams, invalidateYoutubeCache } from "./youtube";

/**
 * Общая лента раздела «Медиа»: эфиры Twitch (по ключевым словам и по списку каналов) и YouTube (только по списку каналов).
 * Площадки опрашиваются независимо: если одна не отвечает, вторая продолжает работать, а причина сбоя уходит администрации.
 */

export function invalidateMediaCache(): void {
  invalidateTwitchCache();
  invalidateYoutubeCache();
}

const newest = (...dates: (string | null)[]) =>
  dates
    .filter((date): date is string => date !== null)
    .sort()
    .at(-1) ?? null;

export async function getMediaFeed(): Promise<MediaResponse> {
  const twitch = await getMediaStreams();

  // Список YouTube-каналов читается из базы; без базы раздел остаётся рабочим на одном Twitch
  let youtubeChannels: TrackedChannel[] = [];
  if (process.env.DATABASE_URL) {
    try {
      youtubeChannels = await listChannels("youtube");
    } catch (error) {
      console.error(
        "[media] не удалось прочитать список каналов YouTube:",
        error instanceof Error ? error.message : error,
      );
    }
  }
  const youtube = await getYoutubeStreams(youtubeChannels);

  const channels = [...twitch.channels, ...youtubeChannels];
  // errors — площадка не ответила, hints — не заданы ключи, но каналы этой площадки в списке есть
  const errors: string[] = [];
  const hints: string[] = [];
  const streams: MediaStream[] = [];
  let anyOk = false;
  let stale = false;
  let updatedAt: string | null = null;

  if (twitch.status === "ok") {
    anyOk = true;
    streams.push(...twitch.streams);
    stale ||= twitch.stale === true;
    updatedAt = newest(updatedAt, twitch.updatedAt);
  } else if (twitch.status === "error") {
    errors.push(twitch.problem ?? "Twitch сейчас не отвечает.");
  }

  if (youtube.status === "ok") {
    // Без каналов YouTube ничего не добавляет и ни на что не влияет
    if (youtubeChannels.length > 0) {
      anyOk = true;
      streams.push(...youtube.streams);
      stale ||= youtube.stale === true;
      updatedAt = newest(updatedAt, youtube.updatedAt);
    }
  } else if (youtube.status === "error") {
    errors.push(youtube.problem);
  } else if (youtubeChannels.length > 0) {
    hints.push("Для YouTube не задан YOUTUBE_API_KEY, эфиры каналов YouTube не проверяются.");
  }

  streams.sort(
    (a, b) => Number(b.tracked) - Number(a.tracked) || b.viewers - a.viewers || a.name.localeCompare(b.name),
  );

  if (anyOk) {
    const warnings = [...errors, ...hints];
    return {
      status: "ok",
      streams,
      channels,
      updatedAt,
      ...(stale ? { stale: true } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }
  return {
    status: errors.length > 0 ? "error" : "unconfigured",
    streams: [],
    channels,
    updatedAt: null,
    ...(errors.length > 0 ? { problem: errors.join(" ") } : {}),
  };
}
