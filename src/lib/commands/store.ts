import { randomUUID } from "node:crypto";

import { seedCommands, type ServerCommand } from "@/app/(main)/(dashboard)/commands/_data/commands";
import { getPool } from "@/lib/db/pool";

import type { CommandInput } from "./validate";

/**
 * Команды сервера хранятся в Postgres (таблица server_commands).
 * При первом обращении таблица создаётся и заполняется встроенными командами из _data/commands.ts.
 * Если базы нет или она недоступна, сайт показывает встроенные команды, а редактирование отключено.
 */

export class CommandStoreError extends Error {
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
    await client.query(`CREATE TABLE IF NOT EXISTS server_commands (
      id text PRIMARY KEY,
      position bigserial NOT NULL,
      level integer NOT NULL,
      command text NOT NULL,
      argument text NOT NULL DEFAULT '',
      description text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text
    )`);
    const existing = await client.query("SELECT 1 FROM server_commands LIMIT 1");
    if (existing.rowCount === 0) {
      for (const item of seedCommands) {
        await client.query(
          `INSERT INTO server_commands (id, level, command, argument, description)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
          [item.id, item.level, item.command, item.argument, item.description],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[commands] ROLLBACK failed", rollbackError));
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
export type CommandList = { commands: ServerCommand[]; editable: boolean; problem: string | null };

export async function listCommands(): Promise<CommandList> {
  if (!process.env.DATABASE_URL) {
    return { commands: [...seedCommands], editable: false, problem: "не задана переменная DATABASE_URL" };
  }
  try {
    await ensureReady();
    const { rows } = await getPool().query<ServerCommand>(
      "SELECT id, level, command, argument, description FROM server_commands ORDER BY position ASC",
    );
    return { commands: rows, editable: true, problem: null };
  } catch (error) {
    console.error("[commands] База недоступна, показываем встроенные команды", error);
    const detail = error instanceof Error ? error.message : String(error);
    return { commands: [...seedCommands], editable: false, problem: detail.slice(0, 200) };
  }
}

async function run<T>(task: () => Promise<T>): Promise<T> {
  try {
    await ensureReady();
    return await task();
  } catch (error) {
    if (error instanceof CommandStoreError) throw error;
    throw new CommandStoreError("database", error);
  }
}

export const createCommand = (input: CommandInput, updatedBy: string) =>
  run(async () => {
    const id = randomUUID();
    await getPool().query(
      `INSERT INTO server_commands (id, level, command, argument, description, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, input.level, input.command, input.argument, input.description, updatedBy],
    );
    return id;
  });

export const updateCommand = (id: string, input: CommandInput, updatedBy: string) =>
  run(async () => {
    const result = await getPool().query(
      `UPDATE server_commands
       SET level = $2, command = $3, argument = $4, description = $5, updated_at = now(), updated_by = $6
       WHERE id = $1`,
      [id, input.level, input.command, input.argument, input.description, updatedBy],
    );
    if (result.rowCount === 0) throw new CommandStoreError("not_found");
  });

export const deleteCommand = (id: string) =>
  run(async () => {
    const result = await getPool().query("DELETE FROM server_commands WHERE id = $1", [id]);
    if (result.rowCount === 0) throw new CommandStoreError("not_found");
  });
