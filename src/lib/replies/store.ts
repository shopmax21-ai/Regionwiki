import { type QuickReply, seedReplies } from "@/app/(main)/dashboard/replies/_data/replies";
import { getPool } from "@/lib/db/pool";

import type { ReplyInput } from "./validate";
import { randomUUID } from "node:crypto";

/**
 * Быстрые ответы хранятся в Postgres (таблица quick_replies).
 * При первом обращении таблица создаётся и заполняется встроенными ответами из _data/replies.ts.
 * Если базы нет или она недоступна, сайт показывает встроенные ответы, а редактирование отключено.
 */

export class ReplyStoreError extends Error {
  constructor(
    readonly code: "not_found" | "database",
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}

const LOCK_ID = 727_002;

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Блокировка нужна, чтобы два запущенных сервиса не создавали и не заполняли таблицу одновременно.
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS quick_replies (
      id text PRIMARY KEY,
      position bigserial NOT NULL,
      category text NOT NULL,
      title text NOT NULL,
      text text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text
    )`);
    // Таблица могла быть создана раньше с другим набором колонок: достраиваем недостающие, иначе чтение упадёт.
    await client.query("ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS position bigserial");
    await client.query("ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS text text NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()");
    await client.query("ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()");
    await client.query("ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS updated_by text");
    const existing = await client.query("SELECT 1 FROM quick_replies LIMIT 1");
    if (existing.rowCount === 0) {
      for (const reply of seedReplies) {
        await client.query(
          "INSERT INTO quick_replies (id, category, title, text) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
          [reply.id, reply.category, reply.title, reply.text],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[replies] ROLLBACK failed", rollbackError));
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

/** problem — почему редактирование недоступно (null, если всё в порядке). Показывается тем, у кого есть право редактирования. */
export type ReplyList = { replies: QuickReply[]; editable: boolean; problem: string | null };

type ReplyRow = { id: string; category: string; title: string; text: string };

const toReply = (row: ReplyRow): QuickReply => ({
  id: row.id,
  category: row.category,
  title: row.title,
  text: row.text,
});

export async function listReplies(): Promise<ReplyList> {
  if (!process.env.DATABASE_URL) {
    return { replies: [...seedReplies], editable: false, problem: "не задана переменная DATABASE_URL" };
  }
  try {
    await ensureReady();
    const { rows } = await getPool().query<ReplyRow>(
      "SELECT id, category, title, text FROM quick_replies ORDER BY position ASC",
    );
    return { replies: rows.map(toReply), editable: true, problem: null };
  } catch (error) {
    console.error("[replies] База недоступна, показываем встроенные ответы", error);
    const detail = error instanceof Error ? error.message : String(error);
    return { replies: [...seedReplies], editable: false, problem: detail.slice(0, 200) };
  }
}

async function run<T>(task: () => Promise<T>): Promise<T> {
  try {
    await ensureReady();
    return await task();
  } catch (error) {
    if (error instanceof ReplyStoreError) throw error;
    throw new ReplyStoreError("database", error);
  }
}

export const createReply = (input: ReplyInput, updatedBy: string) =>
  run(async () => {
    const id = randomUUID();
    await getPool().query(
      "INSERT INTO quick_replies (id, category, title, text, updated_by) VALUES ($1, $2, $3, $4, $5)",
      [id, input.category, input.title, input.text, updatedBy],
    );
    return id;
  });

export const updateReply = (id: string, input: ReplyInput, updatedBy: string) =>
  run(async () => {
    const result = await getPool().query(
      `UPDATE quick_replies SET category = $2, title = $3, text = $4, updated_at = now(), updated_by = $5
       WHERE id = $1`,
      [id, input.category, input.title, input.text, updatedBy],
    );
    if (result.rowCount === 0) throw new ReplyStoreError("not_found");
  });

export const deleteReply = (id: string) =>
  run(async () => {
    const result = await getPool().query("DELETE FROM quick_replies WHERE id = $1", [id]);
    if (result.rowCount === 0) throw new ReplyStoreError("not_found");
  });
