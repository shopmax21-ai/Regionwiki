import { type MapPlace, type PlaceCategoryId, seedPlaces } from "@/app/(main)/dashboard/map/_components/map-data";
import { getPool } from "@/lib/db/pool";

import type { PlaceInput } from "./validate";
import { randomUUID } from "node:crypto";

/**
 * Метки карты хранятся в Postgres (таблица map_places).
 * При первом обращении таблица создаётся и заполняется встроенными метками из map-data.ts.
 * Если базы нет или она недоступна, сайт показывает встроенные метки, а редактирование отключено.
 */

export class MapStoreError extends Error {
  constructor(
    readonly code: "not_found" | "database",
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}

const LOCK_ID = 727_003;

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Блокировка нужна, чтобы два запущенных сервиса не создавали и не заполняли таблицу одновременно.
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS map_places (
      id text PRIMARY KEY,
      position bigserial NOT NULL,
      name text NOT NULL,
      category text NOT NULL,
      x double precision NOT NULL,
      y double precision NOT NULL,
      description text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text
    )`);
    // Своя иконка метки появилась позже первых версий таблицы
    await client.query("ALTER TABLE map_places ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT ''");
    const existing = await client.query("SELECT 1 FROM map_places LIMIT 1");
    if (existing.rowCount === 0) {
      for (const place of seedPlaces) {
        await client.query(
          "INSERT INTO map_places (id, name, category, x, y) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
          [place.id, place.name, place.category, place.x, place.y],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[map] ROLLBACK failed", rollbackError));
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

// Версия растёт при каждой записи: по ней поиск понимает, что индекс меток устарел.
let version = 0;
export const getMapPlacesVersion = () => version;

/** problem — почему редактирование недоступно (null, если всё в порядке). Показывается тем, у кого есть право редактирования. */
export type MapPlaceList = { places: MapPlace[]; editable: boolean; problem: string | null };

type PlaceRow = {
  id: string;
  name: string;
  category: string;
  x: number;
  y: number;
  description: string;
  icon: string;
};

const toPlace = (row: PlaceRow): MapPlace => ({
  id: row.id,
  name: row.name,
  category: row.category as PlaceCategoryId,
  x: row.x,
  y: row.y,
  description: row.description || undefined,
  icon: row.icon || undefined,
});

export async function listMapPlaces(): Promise<MapPlaceList> {
  if (!process.env.DATABASE_URL) {
    return { places: [...seedPlaces], editable: false, problem: "не задана переменная DATABASE_URL" };
  }
  try {
    await ensureReady();
    const { rows } = await getPool().query<PlaceRow>(
      "SELECT id, name, category, x, y, description, icon FROM map_places ORDER BY position ASC",
    );
    return { places: rows.map(toPlace), editable: true, problem: null };
  } catch (error) {
    console.error("[map] База недоступна, показываем встроенные метки", error);
    const detail = error instanceof Error ? error.message : String(error);
    return { places: [...seedPlaces], editable: false, problem: detail.slice(0, 200) };
  }
}

async function run<T>(task: () => Promise<T>): Promise<T> {
  try {
    await ensureReady();
    return await task();
  } catch (error) {
    if (error instanceof MapStoreError) throw error;
    throw new MapStoreError("database", error);
  }
}

export const createMapPlace = (input: PlaceInput, updatedBy: string) =>
  run(async () => {
    const id = randomUUID();
    await getPool().query(
      "INSERT INTO map_places (id, name, category, x, y, description, icon, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [id, input.name, input.category, input.x, input.y, input.description, input.icon, updatedBy],
    );
    version++;
    return id;
  });

export const updateMapPlace = (id: string, input: PlaceInput, updatedBy: string) =>
  run(async () => {
    const result = await getPool().query(
      `UPDATE map_places SET name = $2, category = $3, x = $4, y = $5, description = $6, icon = $7, updated_at = now(), updated_by = $8
       WHERE id = $1`,
      [id, input.name, input.category, input.x, input.y, input.description, input.icon, updatedBy],
    );
    if (result.rowCount === 0) throw new MapStoreError("not_found");
    version++;
  });

export const deleteMapPlace = (id: string) =>
  run(async () => {
    const result = await getPool().query("DELETE FROM map_places WHERE id = $1", [id]);
    if (result.rowCount === 0) throw new MapStoreError("not_found");
    version++;
  });

const duplicateKey = (place: { name: string; x: number; y: number }) =>
  `${place.name.trim().toLowerCase()}|${Math.round(place.x * 100)}|${Math.round(place.y * 100)}`;

/**
 * Добавляет много меток одной транзакцией: либо все, либо ни одной.
 * Метки, которые уже есть на карте (то же название и те же координаты), пропускаются, поэтому повторная загрузка
 * того же файла ничего не задваивает.
 */
export const createMapPlaces = (inputs: PlaceInput[], updatedBy: string) =>
  run(async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<{ name: string; x: number; y: number }>("SELECT name, x, y FROM map_places");
      const seen = new Set(rows.map(duplicateKey));
      let added = 0;
      let skipped = 0;
      for (const input of inputs) {
        const key = duplicateKey(input);
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
        await client.query(
          "INSERT INTO map_places (id, name, category, x, y, description, icon, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          [randomUUID(), input.name, input.category, input.x, input.y, input.description, input.icon, updatedBy],
        );
        added++;
      }
      await client.query("COMMIT");
      if (added > 0) version++;
      return { added, skipped };
    } catch (error) {
      await client.query("ROLLBACK").catch((rollbackError) => console.error("[map] ROLLBACK failed", rollbackError));
      throw error;
    } finally {
      client.release();
    }
  });
