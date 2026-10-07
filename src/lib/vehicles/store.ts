import { vehicles as seedVehicles, type Vehicle } from "@/app/(main)/(dashboard)/transport/_data/vehicles";
import { getPool } from "@/lib/db/pool";

/**
 * Транспорт хранится в Postgres (таблица vehicles, объект целиком в jsonb).
 * При первом обращении таблица создаётся и заполняется встроенными данными из _data/vehicles.ts.
 * Если базы нет или она недоступна, сайт показывает встроенные данные, а редактирование отключено.
 */

export class VehicleStoreError extends Error {
  constructor(
    readonly code: "exists" | "not_found" | "database",
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}

const LOCK_ID = 727_001;

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Блокировка нужна, чтобы два запущенных сервиса не создавали и не заполняли таблицу одновременно.
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS vehicles (
      code text PRIMARY KEY,
      position bigserial NOT NULL,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text
    )`);
    const existing = await client.query("SELECT 1 FROM vehicles LIMIT 1");
    if (existing.rowCount === 0) {
      // Вставляем с конца: у первого в списке самая большая позиция, а список выводится по убыванию позиции.
      for (const vehicle of [...seedVehicles].reverse()) {
        await client.query("INSERT INTO vehicles (code, data) VALUES ($1, $2::jsonb) ON CONFLICT (code) DO NOTHING", [
          vehicle.code,
          JSON.stringify(vehicle),
        ]);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[vehicles] ROLLBACK failed", rollbackError));
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

// Версия растёт при каждой записи: по ней поиск понимает, что индекс транспорта устарел.
let version = 0;
export const getVehiclesVersion = () => version;

export type VehicleList = { vehicles: Vehicle[]; editable: boolean };

export async function listVehicles(): Promise<VehicleList> {
  if (!process.env.DATABASE_URL) return { vehicles: seedVehicles, editable: false };
  try {
    await ensureReady();
    const { rows } = await getPool().query("SELECT data FROM vehicles ORDER BY position DESC");
    return { vehicles: rows.map((row) => row.data as Vehicle), editable: true };
  } catch (error) {
    console.error("[vehicles] База недоступна, показываем встроенные данные", error);
    return { vehicles: seedVehicles, editable: false };
  }
}

export async function getVehicleByCode(code: string): Promise<{ vehicle: Vehicle | null; editable: boolean }> {
  if (!process.env.DATABASE_URL)
    return { vehicle: seedVehicles.find((item) => item.code === code) ?? null, editable: false };
  try {
    await ensureReady();
    const { rows } = await getPool().query("SELECT data FROM vehicles WHERE code = $1", [code]);
    return { vehicle: (rows[0]?.data as Vehicle | undefined) ?? null, editable: true };
  } catch (error) {
    console.error("[vehicles] База недоступна, показываем встроенные данные", error);
    return { vehicle: seedVehicles.find((item) => item.code === code) ?? null, editable: false };
  }
}

export async function createVehicle(vehicle: Vehicle, userId: string): Promise<void> {
  try {
    await ensureReady();
    await getPool().query("INSERT INTO vehicles (code, data, updated_by) VALUES ($1, $2::jsonb, $3)", [
      vehicle.code,
      JSON.stringify(vehicle),
      userId,
    ]);
    version++;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw new VehicleStoreError("exists", error);
    throw new VehicleStoreError("database", error);
  }
}

export async function updateVehicle(vehicle: Vehicle, userId: string): Promise<void> {
  let updated = 0;
  try {
    await ensureReady();
    const result = await getPool().query(
      "UPDATE vehicles SET data = $2::jsonb, updated_at = now(), updated_by = $3 WHERE code = $1",
      [vehicle.code, JSON.stringify(vehicle), userId],
    );
    updated = result.rowCount ?? 0;
  } catch (error) {
    throw new VehicleStoreError("database", error);
  }
  if (updated === 0) throw new VehicleStoreError("not_found");
  version++;
}

export async function deleteVehicle(code: string): Promise<void> {
  let deleted = 0;
  try {
    await ensureReady();
    const result = await getPool().query("DELETE FROM vehicles WHERE code = $1", [code]);
    deleted = result.rowCount ?? 0;
  } catch (error) {
    throw new VehicleStoreError("database", error);
  }
  if (deleted === 0) throw new VehicleStoreError("not_found");
  version++;
}
