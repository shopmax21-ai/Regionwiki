import { getPool } from "@/lib/db/pool";

/**
 * Небольшое хранилище записей в Postgres: одна таблица, у каждой записи свой текстовый код,
 * сама запись целиком лежит в jsonb. Так устроены транспорт, бизнесы и недвижимость.
 * При первом обращении таблица создаётся и заполняется встроенными данными. Если базы нет или она недоступна,
 * сайт показывает встроенные данные, а редактирование отключено.
 */

export class RecordStoreError extends Error {
  constructor(
    readonly code: "exists" | "not_found" | "database",
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}

export type RecordList<T> = { items: T[]; editable: boolean };

type Options<T> = {
  /** Имя таблицы: берётся только из кода, не из запроса */
  table: string;
  /** Номер блокировки, чтобы два запущенных сервиса не заполняли таблицу одновременно */
  lockId: number;
  seed: readonly T[];
  keyOf: (item: T) => string;
  /** Для сообщений в логе */
  tag: string;
};

export function createJsonStore<T>({ table, lockId, seed, keyOf, tag }: Options<T>) {
  let ready: Promise<void> | null = null;
  // Растёт при каждой записи: по нему поиск понимает, что его индекс устарел
  let version = 0;

  async function init(): Promise<void> {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);
      await client.query(`CREATE TABLE IF NOT EXISTS ${table} (
        code text PRIMARY KEY,
        position bigserial NOT NULL,
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by text
      )`);
      const existing = await client.query(`SELECT 1 FROM ${table} LIMIT 1`);
      if (existing.rowCount === 0) {
        // Вставляем с конца: у первого в списке самая большая позиция, а список выводится по убыванию позиции
        for (const item of [...seed].reverse()) {
          await client.query(`INSERT INTO ${table} (code, data) VALUES ($1, $2::jsonb) ON CONFLICT (code) DO NOTHING`, [
            keyOf(item),
            JSON.stringify(item),
          ]);
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch((rollbackError) => console.error(`[${tag}] ROLLBACK failed`, rollbackError));
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

  async function list(): Promise<RecordList<T>> {
    if (!process.env.DATABASE_URL) return { items: [...seed], editable: false };
    try {
      await ensureReady();
      const { rows } = await getPool().query(`SELECT data FROM ${table} ORDER BY position DESC`);
      return { items: rows.map((row) => row.data as T), editable: true };
    } catch (error) {
      console.error(`[${tag}] База недоступна, показываем встроенные данные`, error);
      return { items: [...seed], editable: false };
    }
  }

  async function create(item: T, userId: string): Promise<void> {
    try {
      await ensureReady();
      await getPool().query(`INSERT INTO ${table} (code, data, updated_by) VALUES ($1, $2::jsonb, $3)`, [
        keyOf(item),
        JSON.stringify(item),
        userId,
      ]);
      version++;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new RecordStoreError("exists", error);
      throw new RecordStoreError("database", error);
    }
  }

  async function update(item: T, userId: string): Promise<void> {
    let updated = 0;
    try {
      await ensureReady();
      const result = await getPool().query(
        `UPDATE ${table} SET data = $2::jsonb, updated_at = now(), updated_by = $3 WHERE code = $1`,
        [keyOf(item), JSON.stringify(item), userId],
      );
      updated = result.rowCount ?? 0;
    } catch (error) {
      throw new RecordStoreError("database", error);
    }
    if (updated === 0) throw new RecordStoreError("not_found");
    version++;
  }

  async function remove(code: string): Promise<void> {
    let deleted = 0;
    try {
      await ensureReady();
      const result = await getPool().query(`DELETE FROM ${table} WHERE code = $1`, [code]);
      deleted = result.rowCount ?? 0;
    } catch (error) {
      throw new RecordStoreError("database", error);
    }
    if (deleted === 0) throw new RecordStoreError("not_found");
    version++;
  }

  return { list, create, update, remove, version: () => version };
}
