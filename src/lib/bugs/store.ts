import { getPeopleSafe } from "@/lib/auth/db";
import { type Person, personFromName } from "@/lib/auth/person";
import { getPool } from "@/lib/db/pool";

import { type BugCounts, type BugReport, type BugStatus, isBugStatus } from "./types";
import type { BugInput } from "./validate";
import { randomUUID } from "node:crypto";

/**
 * Баг-репорты в Postgres (таблица bug_reports). Таблица создаётся при первом обращении.
 * Запись и чтение требуют базы: без неё отправка недоступна, а раздел сообщает об этом.
 */

export class BugStoreError extends Error {
  constructor(
    readonly code: "not_found" | "rate_limit" | "database",
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}

const LOCK_ID = 727_011;
/** Не больше стольких сообщений за час: защита от спама. Гости считаются по IP, вошедшие по аккаунту. */
export const BUG_HOURLY_LIMIT = { guest: 5, member: 20 } as const;

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS bug_reports (
      id            text PRIMARY KEY,
      title         text NOT NULL,
      description   text NOT NULL,
      page_path     text NOT NULL DEFAULT '/',
      reporter_id   text NOT NULL,
      reporter_name text NOT NULL,
      status        text NOT NULL DEFAULT 'new',
      assignee_id   text,
      assignee_name text,
      taken_at      timestamptz,
      done_by_id    text,
      done_by_name  text,
      done_at       timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query("CREATE INDEX IF NOT EXISTS bug_reports_status_idx ON bug_reports (status, created_at DESC)");
    await client.query(
      "CREATE INDEX IF NOT EXISTS bug_reports_reporter_idx ON bug_reports (reporter_id, created_at DESC)",
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[bugs] ROLLBACK failed", rollbackError));
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

async function run<T>(task: () => Promise<T>): Promise<T> {
  try {
    await ensureReady();
    return await task();
  } catch (error) {
    if (error instanceof BugStoreError) throw error;
    throw new BugStoreError("database", error);
  }
}

type Reporter = { id: string; name: string };

export const createBug = (input: BugInput, reporter: Reporter, hourlyLimit: number) =>
  run(async () => {
    const recent = await getPool().query<{ total: string }>(
      "SELECT count(*) AS total FROM bug_reports WHERE reporter_id = $1 AND created_at > now() - interval '1 hour'",
      [reporter.id],
    );
    if (Number(recent.rows[0]?.total ?? 0) >= hourlyLimit) throw new BugStoreError("rate_limit");

    const id = randomUUID();
    await getPool().query(
      `INSERT INTO bug_reports (id, title, description, page_path, reporter_id, reporter_name)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, input.title, input.description, input.pagePath, reporter.id, reporter.name.slice(0, 200)],
    );
    return id;
  });

type BugRow = {
  id: string;
  title: string;
  description: string;
  page_path: string;
  reporter_id: string;
  reporter_name: string;
  status: string;
  assignee_id: string | null;
  assignee_name: string | null;
  taken_at: Date | null;
  done_by_id: string | null;
  done_by_name: string | null;
  done_at: Date | null;
  created_at: Date;
};

export async function listBugs(status?: BugStatus): Promise<{ bugs: BugReport[]; counts: BugCounts }> {
  return run(async () => {
    const pool = getPool();
    const [{ rows }, countRows] = await Promise.all([
      pool.query<BugRow>(
        `SELECT id, title, description, page_path, reporter_id, reporter_name, status, assignee_id, assignee_name,
                taken_at, done_by_id, done_by_name, done_at, created_at
         FROM bug_reports
         WHERE ($1::text IS NULL OR status = $1)
         ORDER BY created_at DESC
         LIMIT 200`,
        [status ?? null],
      ),
      pool.query<{ status: string; total: string }>(
        "SELECT status, count(*) AS total FROM bug_reports GROUP BY status",
      ),
    ]);

    const counts: BugCounts = { new: 0, in_progress: 0, done: 0 };
    for (const row of countRows.rows) if (isBugStatus(row.status)) counts[row.status] = Number(row.total);

    const ids = new Set<string>();
    for (const row of rows) {
      ids.add(row.reporter_id);
      if (row.assignee_id) ids.add(row.assignee_id);
      if (row.done_by_id) ids.add(row.done_by_id);
    }
    const people = await getPeopleSafe([...ids]);
    const person = (id: string, name: string): Person => people.get(id) ?? personFromName(name, id);

    const bugs = rows.map<BugReport>((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      pagePath: row.page_path,
      createdAt: row.created_at.toISOString(),
      reporter: person(row.reporter_id, row.reporter_name),
      status: isBugStatus(row.status) ? row.status : "new",
      assignee: row.assignee_id ? person(row.assignee_id, row.assignee_name ?? "") : null,
      takenAt: row.taken_at?.toISOString() ?? null,
      doneBy: row.done_by_id ? person(row.done_by_id, row.done_by_name ?? "") : null,
      doneAt: row.done_at?.toISOString() ?? null,
    }));
    return { bugs, counts };
  });
}

/**
 * Меняет статус. «В работе»: запоминает, кто взял; «Выполнено»: кто и когда закрыл; «Новый»: сбрасывает отметки.
 * Возвращает название репорта для журнала или бросает not_found.
 */
export const setBugStatus = (id: string, status: BugStatus, actor: Reporter) =>
  run(async () => {
    const name = actor.name.slice(0, 200);
    const result = await getPool().query<{ title: string }>(
      `UPDATE bug_reports SET
         status = $2,
         assignee_id   = CASE $2::text WHEN 'new' THEN NULL WHEN 'in_progress' THEN $3::text ELSE COALESCE(assignee_id, $3::text) END,
         assignee_name = CASE $2::text WHEN 'new' THEN NULL WHEN 'in_progress' THEN $4::text ELSE COALESCE(assignee_name, $4::text) END,
         taken_at      = CASE $2::text WHEN 'new' THEN NULL WHEN 'in_progress' THEN now() ELSE COALESCE(taken_at, now()) END,
         done_by_id    = CASE $2::text WHEN 'done' THEN $3::text ELSE NULL END,
         done_by_name  = CASE $2::text WHEN 'done' THEN $4::text ELSE NULL END,
         done_at       = CASE $2::text WHEN 'done' THEN now() ELSE NULL END,
         updated_at    = now()
       WHERE id = $1
       RETURNING title`,
      [id, status, actor.id, name],
    );
    if (result.rowCount === 0) throw new BugStoreError("not_found");
    return result.rows[0].title;
  });

export const countNewBugs = () =>
  run(async () => {
    const { rows } = await getPool().query<{ total: string }>(
      "SELECT count(*) AS total FROM bug_reports WHERE status = 'new'",
    );
    return Number(rows[0]?.total ?? 0);
  });
