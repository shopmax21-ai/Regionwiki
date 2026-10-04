import { type Item, seedItems } from "@/app/(main)/dashboard/items/_data/items";
import { getPool } from "@/lib/db/pool";

import type { ItemInput } from "./validate";

/**
 * Предметы хранятся в Postgres (таблица wiki_items).
 * Таблица создаётся при первом обращении и один раз заполняется встроенными данными из _data/items.ts:
 * если потом удалить все предметы, они сами не вернутся.
 * Если базы нет или она недоступна, сайт показывает встроенные данные, а редактирование отключено.
 */

export class ItemStoreError extends Error {
  constructor(
    readonly code: "exists" | "not_found" | "database",
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
    const existed = (await client.query("SELECT to_regclass('wiki_items') AS name")).rows[0]?.name !== null;
    await client.query(`CREATE TABLE IF NOT EXISTS wiki_items (
      id integer PRIMARY KEY,
      name text NOT NULL,
      category text NOT NULL,
      image_url text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text
    )`);
    if (!existed) {
      for (const item of seedItems) {
        await client.query(
          "INSERT INTO wiki_items (id, name, category, image_url) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
          [item.id, item.name, item.category, item.imageUrl ?? null],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[items] ROLLBACK failed", rollbackError));
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

type ItemRow = { id: number; name: string; category: Item["category"]; image_url: string | null };

const toItem = (row: ItemRow): Item => ({
  id: row.id,
  name: row.name,
  category: row.category,
  ...(row.image_url ? { imageUrl: row.image_url } : {}),
});

export type ItemList = { items: Item[]; editable: boolean };

export async function listItems(): Promise<ItemList> {
  if (!process.env.DATABASE_URL) return { items: seedItems, editable: false };
  try {
    await ensureReady();
    const { rows } = await getPool().query<ItemRow>("SELECT id, name, category, image_url FROM wiki_items ORDER BY id");
    return { items: rows.map(toItem), editable: true };
  } catch (error) {
    console.error("[items] База недоступна, показываем встроенные данные", error);
    return { items: seedItems, editable: false };
  }
}

export async function createItem(input: ItemInput, userId: string): Promise<Item> {
  try {
    await ensureReady();
    // Без указанного ID берём следующий за самым большим. Если два админа добавят предмет одновременно,
    // второй получит «ID уже занят» и повторит попытку.
    const { rows } = await getPool().query<ItemRow>(
      `INSERT INTO wiki_items (id, name, category, image_url, updated_by)
       VALUES (COALESCE($1::integer, (SELECT COALESCE(MAX(id), 0) + 1 FROM wiki_items)), $2, $3, $4, $5)
       RETURNING id, name, category, image_url`,
      [input.id ?? null, input.name, input.category, input.imageUrl ?? null, userId],
    );
    return toItem(rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw new ItemStoreError("exists", error);
    throw new ItemStoreError("database", error);
  }
}

export async function updateItem(id: number, input: ItemInput, userId: string): Promise<Item> {
  let row: ItemRow | undefined;
  try {
    await ensureReady();
    const result = await getPool().query<ItemRow>(
      `UPDATE wiki_items SET name = $2, category = $3, image_url = $4, updated_at = now(), updated_by = $5
       WHERE id = $1
       RETURNING id, name, category, image_url`,
      [id, input.name, input.category, input.imageUrl ?? null, userId],
    );
    row = result.rows[0];
  } catch (error) {
    throw new ItemStoreError("database", error);
  }
  if (!row) throw new ItemStoreError("not_found");
  return toItem(row);
}

export async function deleteItem(id: number): Promise<void> {
  let deleted = 0;
  try {
    await ensureReady();
    const result = await getPool().query("DELETE FROM wiki_items WHERE id = $1", [id]);
    deleted = result.rowCount ?? 0;
  } catch (error) {
    throw new ItemStoreError("database", error);
  }
  if (deleted === 0) throw new ItemStoreError("not_found");
}
