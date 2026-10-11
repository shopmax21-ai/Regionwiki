import { getPool } from "@/lib/db/pool";

import {
  DEFAULT_MEDIA_PR_INFO,
  type MediaPrEntry,
  type MediaPrInput,
  type MediaPrPlatform,
  type MediaPrStatus,
} from "./types";
import { randomUUID } from "node:crypto";

/**
 * Раздел «Медиа PR»: таблица медиа (media_pr_entries) и справка раздела (media_pr_info).
 * Таблицы создаются при первом обращении.
 */

export class MediaPrStoreError extends Error {
  constructor(readonly code: "not_found" | "database") {
    super(code);
  }
}

const LOCK_ID = 727_021;

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS media_pr_entries (
      id text PRIMARY KEY,
      position bigserial NOT NULL,
      name text NOT NULL,
      platform text NOT NULL,
      url text NOT NULL DEFAULT '',
      contact text NOT NULL DEFAULT '',
      audience bigint,
      status text NOT NULL,
      note text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS media_pr_info (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text
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

/** Любой сбой базы превращается в MediaPrStoreError("database"), чтобы страница показала понятное сообщение. */
async function run<T>(task: () => Promise<T>): Promise<T> {
  try {
    await ensureReady();
    return await task();
  } catch (error) {
    if (error instanceof MediaPrStoreError) throw error;
    throw new MediaPrStoreError("database");
  }
}

type EntryRow = {
  id: string;
  name: string;
  platform: string;
  url: string;
  contact: string;
  audience: string | null;
  status: string;
  note: string;
  updated_at: Date;
};

const toEntry = (row: EntryRow): MediaPrEntry => ({
  id: row.id,
  name: row.name,
  platform: row.platform as MediaPrPlatform,
  url: row.url,
  contact: row.contact,
  audience: row.audience === null ? null : Number(row.audience),
  status: row.status as MediaPrStatus,
  note: row.note,
  updatedAt: row.updated_at.toISOString(),
});

export const listMediaPrEntries = () =>
  run(async () => {
    const { rows } = await getPool().query<EntryRow>(
      "SELECT id, name, platform, url, contact, audience, status, note, updated_at FROM media_pr_entries ORDER BY position ASC",
    );
    return rows.map(toEntry);
  });

export const createMediaPrEntry = (input: MediaPrInput, updatedBy: string) =>
  run(async () => {
    const id = randomUUID();
    await getPool().query(
      `INSERT INTO media_pr_entries (id, name, platform, url, contact, audience, status, note, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, input.name, input.platform, input.url, input.contact, input.audience, input.status, input.note, updatedBy],
    );
    return id;
  });

export const updateMediaPrEntry = (id: string, input: MediaPrInput, updatedBy: string) =>
  run(async () => {
    const result = await getPool().query(
      `UPDATE media_pr_entries
       SET name = $2, platform = $3, url = $4, contact = $5, audience = $6, status = $7, note = $8,
           updated_at = now(), updated_by = $9
       WHERE id = $1`,
      [id, input.name, input.platform, input.url, input.contact, input.audience, input.status, input.note, updatedBy],
    );
    if (result.rowCount === 0) throw new MediaPrStoreError("not_found");
  });

/** Название удалённой записи (для журнала) или null, если такой записи нет. */
export const deleteMediaPrEntry = (id: string) =>
  run(async () => {
    const result = await getPool().query<{ name: string }>(
      "DELETE FROM media_pr_entries WHERE id = $1 RETURNING name",
      [id],
    );
    return result.rows[0]?.name ?? null;
  });

export const getMediaPrInfo = () =>
  run(async () => {
    const { rows } = await getPool().query<{ value: string }>("SELECT value FROM media_pr_info WHERE key = 'info'");
    return rows[0]?.value ?? DEFAULT_MEDIA_PR_INFO;
  });

/** Пустой текст возвращает справку по умолчанию. */
export const setMediaPrInfo = (text: string, updatedBy: string) =>
  run(async () => {
    if (text === "") {
      await getPool().query("DELETE FROM media_pr_info WHERE key = 'info'");
      return;
    }
    await getPool().query(
      `INSERT INTO media_pr_info (key, value, updated_by) VALUES ('info', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [text, updatedBy],
    );
  });
