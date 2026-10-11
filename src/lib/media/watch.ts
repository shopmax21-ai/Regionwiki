import { getAuthConfig } from "@/lib/auth/config";
import { listMediaSubscribers } from "@/lib/auth/db";
import { sendMessage } from "@/lib/auth/telegram";

import { claimStreamNotification, listNotifyChannels, releaseStreamNotification } from "./channels";
import { fetchStreamsByLogins, isTwitchConfigured } from "./twitch";
import { fetchYoutubeLive, isYoutubeConfigured } from "./youtube";

/**
 * Оповещения о начале трансляций. Раз в минуту проверяем каналы из списка с включённым оповещением и, когда
 * эфир только начался, пишем в Telegram администраторам, которые включили оповещения на странице «Медиа».
 * Каждая трансляция оповещается один раз. Эфир, начатый давно (например, до добавления канала или до
 * перезапуска сайта), не оповещается: сообщение «начал трансляцию» через три часа вводило бы в заблуждение.
 */

const CHECK_INTERVAL_MS = 60_000;
/** Эфир старше этого срока считается уже идущим, а не только что начатым */
const FRESH_MS = 15 * 60_000;

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function streamStartedText(stream: { name: string; url: string; title: string; game: string }): string {
  const lines = [`🔴 <b>${escapeHtml(stream.name)}</b> начал трансляцию`];
  if (stream.title.trim()) lines.push("", escapeHtml(stream.title.trim()));
  if (stream.game) lines.push(`🎮 ${escapeHtml(stream.game)}`);
  lines.push(`🔗 ${stream.url}`);
  lines.push("", "Отключить оповещения можно в разделе «Медиа» на сайте.");
  return lines.join("\n");
}

type Candidate = { login: string; streamId: string; startedAt: string; text: string };

/** Эфиры Twitch у каналов с включённым оповещением. */
async function twitchCandidates(): Promise<Candidate[]> {
  if (!isTwitchConfigured()) return [];
  const channels = await listNotifyChannels("twitch");
  if (channels.length === 0) return [];
  const live = await fetchStreamsByLogins(channels.map((channel) => channel.login));
  return live.map((stream) => ({
    login: stream.user_login.toLowerCase(),
    streamId: stream.id,
    startedAt: stream.started_at,
    text: streamStartedText({
      name: stream.user_name || stream.user_login,
      url: `https://www.twitch.tv/${encodeURIComponent(stream.user_login)}`,
      title: stream.title,
      game: stream.game_name,
    }),
  }));
}

/** Эфиры YouTube у каналов с включённым оповещением. */
async function youtubeCandidates(): Promise<Candidate[]> {
  if (!isYoutubeConfigured()) return [];
  const channels = await listNotifyChannels("youtube");
  if (channels.length === 0) return [];
  const names = new Map(channels.map((channel) => [channel.login, channel.name]));
  const live = await fetchYoutubeLive(channels.map((channel) => channel.login));
  return live.map((stream) => ({
    login: stream.channelId,
    streamId: stream.videoId,
    startedAt: stream.startedAt,
    text: streamStartedText({
      name: names.get(stream.channelId) || stream.channelName,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(stream.videoId)}`,
      title: stream.title,
      game: "",
    }),
  }));
}

/** Одна проверка. Возвращает, сколько сообщений ушло. */
export async function checkStreamStarts(): Promise<number> {
  const config = getAuthConfig();
  if (!config) return 0;

  const subscribers = await listMediaSubscribers();
  if (subscribers.length === 0) return 0;

  // Площадки проверяются независимо: сбой одной не должен лишить оповещений вторую
  const results = await Promise.allSettled([twitchCandidates(), youtubeCandidates()]);
  const candidates: Candidate[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") candidates.push(...result.value);
    else
      console.error(
        "[media] Сбой проверки площадки",
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
  }

  const now = Date.now();
  let sent = 0;
  for (const candidate of candidates) {
    if (now - Date.parse(candidate.startedAt) > FRESH_MS) continue;
    if (!(await claimStreamNotification(candidate.login, candidate.streamId))) continue;

    const deliveries = await Promise.allSettled(
      subscribers.map((user) => sendMessage(config, user.telegramId, candidate.text)),
    );
    const delivered = deliveries.filter((delivery) => delivery.status === "fulfilled" && delivery.value).length;
    if (delivered === 0) await releaseStreamNotification(candidate.login, candidate.streamId).catch(() => undefined);
    sent += delivered;
  }
  return sent;
}

/** Запускает проверку раз в минуту внутри процесса сайта (нужен постоянно работающий сервер, как и для напоминаний). */
export function startMediaWatcher(): void {
  const globalState = globalThis as unknown as { __mediaWatcherStarted?: boolean };
  if (globalState.__mediaWatcherStarted) return;
  globalState.__mediaWatcherStarted = true;

  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    checkStreamStarts()
      .then((sent) => {
        if (sent > 0) console.info(`[media] Отправлено оповещений о трансляциях: ${sent}`);
      })
      .catch((error) =>
        console.error("[media] Сбой проверки трансляций", error instanceof Error ? error.message : error),
      )
      .finally(() => {
        running = false;
      });
  };
  setTimeout(tick, 20_000).unref?.();
  setInterval(tick, CHECK_INTERVAL_MS).unref?.();
}
