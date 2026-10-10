import { getPool } from "@/lib/db/pool";

import type { TrackedChannel } from "./types";

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

type ChannelRow = { login: string; name: string; notify: boolean };

const toChannel = (row: ChannelRow): TrackedChannel => ({
  login: row.login,
  name: row.name,
  notify: row.notify,
  url: `https://www.twitch.tv/${row.login}`,
});

export async function listChannels(): Promise<TrackedChannel[]> {
  await ensureReady();
  const result = await getPool().query<ChannelRow>(
    "SELECT login, name, notify FROM media_channels ORDER BY created_at",
  );
  return result.rows.map(toChannel);
}

/** Каналы, для которых включено оповещение о начале трансляции */
export async function listNotifyChannels(): Promise<TrackedChannel[]> {
  return (await listChannels()).filter((channel) => channel.notify);
}

/** false, если канал уже есть в списке */
export async function addChannel(
  channel: { login: string; name: string; notify: boolean },
  addedBy: string,
): Promise<boolean> {
  await ensureReady();
  const result = await getPool().query(
    "INSERT INTO media_channels (login, name, notify, added_by) VALUES ($1, $2, $3, $4) ON CONFLICT (login) DO NOTHING",
    [channel.login, channel.name, channel.notify, addedBy],
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
