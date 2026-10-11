import { getPool } from "@/lib/db/pool";

import type { MediaPlatform, TrackedChannel } from "./types";

/**
 * Каналы, за которыми следит раздел «Медиа» (таблица media_channels). Их трансляции показываются на странице
 * независимо от названия и категории, а при включённом оповещении администраторам уходит сообщение в Telegram,
 * когда эфир начинается.
 */

const LOCK_ID = 727_011;

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS media_channels (
      login text PRIMARY KEY,
      name text NOT NULL,
      notify boolean NOT NULL DEFAULT true,
      last_notified_stream text,
      added_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    // Платформа канала: раньше отслеживался только Twitch, поэтому у старых записей он и остаётся
    await client.query("ALTER TABLE media_channels ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'twitch'");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function ensureReady(): Promise<void> {
  ready ??= init().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

/** Логин Twitch: 4–25 символов, латиница, цифры и подчёркивание. Из ссылки twitch.tv/логин берётся сам логин. */
export function parseTwitchLogin(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  const fromUrl = text.match(/^(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([a-z0-9_]{3,25})(?:[/?#].*)?$/i);
  const login = (fromUrl ? fromUrl[1] : text.replace(/^@/, "")).toLowerCase();
  return /^[a-z0-9_]{3,25}$/.test(login) ? login : null;
}

/** ID канала YouTube: «UC» и 22 символа. Регистр важен. */
const YOUTUBE_CHANNEL_ID = /^UC[\w-]{22}$/;

export const isYoutubeChannelId = (value: string) => YOUTUBE_CHANNEL_ID.test(value);

/**
 * Идентификатор канала из таблицы: логин Twitch (в нижнем регистре) или ID канала YouTube.
 * Используется там, где платформа заранее неизвестна (удаление, оповещения).
 */
export function parseChannelId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (isYoutubeChannelId(text)) return text;
  return parseTwitchLogin(text);
}

type ChannelRow = { login: string; name: string; notify: boolean; platform: string };

const toChannel = (row: ChannelRow): TrackedChannel => {
  const platform: MediaPlatform = row.platform === "youtube" ? "youtube" : "twitch";
  return {
    platform,
    login: row.login,
    name: row.name,
    notify: row.notify,
    url: platform === "youtube" ? `https://www.youtube.com/channel/${row.login}` : `https://www.twitch.tv/${row.login}`,
  };
};

export async function listChannels(platform?: MediaPlatform): Promise<TrackedChannel[]> {
  await ensureReady();
  const result = await getPool().query<ChannelRow>(
    "SELECT login, name, notify, platform FROM media_channels ORDER BY created_at",
  );
  const all = result.rows.map(toChannel);
  return platform ? all.filter((channel) => channel.platform === platform) : all;
}

/** Каналы, для которых включено оповещение о начале трансляции */
export async function listNotifyChannels(platform?: MediaPlatform): Promise<TrackedChannel[]> {
  return (await listChannels(platform)).filter((channel) => channel.notify);
}

/** false, если канал уже есть в списке */
export async function addChannel(
  channel: { platform: MediaPlatform; login: string; name: string; notify: boolean },
  addedBy: string,
): Promise<boolean> {
  await ensureReady();
  const result = await getPool().query(
    "INSERT INTO media_channels (login, name, notify, platform, added_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (login) DO NOTHING",
    [channel.login, channel.name, channel.notify, channel.platform, addedBy],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function removeChannel(login: string): Promise<string | null> {
  await ensureReady();
  const result = await getPool().query<{ name: string }>("DELETE FROM media_channels WHERE login = $1 RETURNING name", [
    login,
  ]);
  return result.rows[0]?.name ?? null;
}

export async function setChannelNotify(login: string, notify: boolean): Promise<string | null> {
  await ensureReady();
  const result = await getPool().query<{ name: string }>(
    "UPDATE media_channels SET notify = $2 WHERE login = $1 RETURNING name",
    [login, notify],
  );
  return result.rows[0]?.name ?? null;
}

/**
 * Занимает право на оповещение об этой трансляции. Вернёт true только одному вызову: если сайт запущен
 * в нескольких экземплярах или проверка совпала по времени, сообщение уйдёт один раз.
 */
export async function claimStreamNotification(login: string, streamId: string): Promise<boolean> {
  await ensureReady();
  const result = await getPool().query(
    "UPDATE media_channels SET last_notified_stream = $2 WHERE login = $1 AND last_notified_stream IS DISTINCT FROM $2",
    [login, streamId],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Если сообщение не ушло ни одному получателю, трансляция снова считается неоповещённой. */
export async function releaseStreamNotification(login: string, streamId: string): Promise<void> {
  await ensureReady();
  await getPool().query(
    "UPDATE media_channels SET last_notified_stream = NULL WHERE login = $1 AND last_notified_stream = $2",
    [login, streamId],
  );
}
