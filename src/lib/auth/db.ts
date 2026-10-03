import { neon } from "@neondatabase/serverless";

import type { AccessRole, AccessStatus } from "./session";

/**
 * Postgres (Neon / Vercel Postgres). Нужна одна переменная DATABASE_URL.
 * Таблицы создаются автоматически при первом обращении.
 */
const sql = neon(process.env.DATABASE_URL ?? "postgres://unset");

let ready: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS users (
      telegram_id   text PRIMARY KEY,
      name          text NOT NULL,
      username      text,
      status        text NOT NULL DEFAULT 'pending',
      role          text NOT NULL DEFAULT 'user',
      created_at    timestamptz NOT NULL DEFAULT now(),
      decided_at    timestamptz,
      decided_by    text,
      last_login_at timestamptz,
      login_count   integer NOT NULL DEFAULT 0
    )`;
    await sql`CREATE TABLE IF NOT EXISTS login_events (
      id          bigserial PRIMARY KEY,
      telegram_id text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      ip          text,
      user_agent  text
    )`;
    await sql`CREATE TABLE IF NOT EXISTS login_attempts (
      token_hash  text PRIMARY KEY,
      telegram_id text,
      name        text,
      username    text,
      code_hash   text,
      attempts    integer NOT NULL DEFAULT 0,
      consumed    boolean NOT NULL DEFAULT false,
      ip          text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      expires_at  timestamptz NOT NULL
    )`;
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

export type DbUser = {
  telegramId: string;
  name: string;
  username: string | null;
  status: AccessStatus;
  role: AccessRole;
  createdAt: Date;
  decidedAt: Date | null;
  lastLoginAt: Date | null;
  loginCount: number;
};

type UserRow = {
  telegram_id: string;
  name: string;
  username: string | null;
  status: AccessStatus;
  role: AccessRole;
  created_at: string;
  decided_at: string | null;
  last_login_at: string | null;
  login_count: number;
};

const toUser = (row: UserRow): DbUser => ({
  telegramId: row.telegram_id,
  name: row.name,
  username: row.username,
  status: row.status,
  role: row.role,
  createdAt: new Date(row.created_at),
  decidedAt: row.decided_at ? new Date(row.decided_at) : null,
  lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
  loginCount: row.login_count,
});

/* ---------- Попытки входа (ссылка на бота → код) ---------- */

export async function countRecentAttempts(ip: string): Promise<number> {
  await ensureSchema();
  const rows = await sql`SELECT count(*)::int AS n FROM login_attempts WHERE ip = ${ip} AND created_at > now() - interval '1 minute'`;
  return (rows[0] as { n: number }).n;
}

export async function createAttempt(tokenHash: string, ip: string, ttlSeconds: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM login_attempts WHERE expires_at < now() - interval '1 day'`;
  await sql`INSERT INTO login_attempts (token_hash, ip, expires_at)
    VALUES (${tokenHash}, ${ip}, now() + ${ttlSeconds} * interval '1 second')`;
}

export type Attempt = {
  telegramId: string | null;
  consumed: boolean;
  expired: boolean;
  attempts: number;
};

export async function getAttempt(tokenHash: string): Promise<Attempt | null> {
  await ensureSchema();
  const rows = await sql`SELECT telegram_id, consumed, attempts, expires_at < now() AS expired
    FROM login_attempts WHERE token_hash = ${tokenHash}`;
  const row = rows[0] as { telegram_id: string | null; consumed: boolean; attempts: number; expired: boolean } | undefined;
  return row ? { telegramId: row.telegram_id, consumed: row.consumed, expired: row.expired, attempts: row.attempts } : null;
}

/**
 * Привязывает попытку к Telegram-аккаунту и сохраняет хэш нового кода.
 * Повторный /start с той же ссылкой выдаёт новый код, но только тому же аккаунту.
 */
export async function bindAttempt(input: {
  tokenHash: string;
  telegramId: string;
  name: string;
  username: string | null;
  codeHash: string;
}): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`UPDATE login_attempts
    SET telegram_id = ${input.telegramId}, name = ${input.name}, username = ${input.username},
        code_hash = ${input.codeHash}, attempts = 0
    WHERE token_hash = ${input.tokenHash} AND consumed = false AND expires_at > now()
      AND (telegram_id IS NULL OR telegram_id = ${input.telegramId})
    RETURNING token_hash`;
  return rows.length > 0;
}

/** Атомарно списывает попытку ввода. Пусто — код истёк, использован или попытки закончились. */
export async function takeAttempt(
  tokenHash: string,
  maxAttempts: number,
): Promise<{ telegramId: string; name: string; username: string | null; codeHash: string } | null> {
  await ensureSchema();
  const rows = await sql`UPDATE login_attempts SET attempts = attempts + 1
    WHERE token_hash = ${tokenHash} AND consumed = false AND expires_at > now()
      AND code_hash IS NOT NULL AND attempts < ${maxAttempts}
    RETURNING telegram_id, name, username, code_hash`;
  const row = rows[0] as { telegram_id: string; name: string; username: string | null; code_hash: string } | undefined;
  return row ? { telegramId: row.telegram_id, name: row.name, username: row.username, codeHash: row.code_hash } : null;
}

/** Помечает код использованным. false — кто-то уже успел (защита от двойного входа). */
export async function consumeAttempt(tokenHash: string): Promise<boolean> {
  const rows = await sql`UPDATE login_attempts SET consumed = true
    WHERE token_hash = ${tokenHash} AND consumed = false RETURNING token_hash`;
  return rows.length > 0;
}

/* ---------- Пользователи ---------- */

/**
 * Первый вход создаёт запись (заявка в статусе pending, у администраторов сразу approved).
 * Каждый следующий вход обновляет профиль и счётчик, а само событие пишется в login_events.
 */
export async function recordLogin(input: {
  telegramId: string;
  name: string;
  username: string | null;
  isAdmin: boolean;
  ip: string;
  userAgent: string;
}): Promise<{ user: DbUser; created: boolean }> {
  await ensureSchema();
  const status: AccessStatus = input.isAdmin ? "approved" : "pending";
  const role: AccessRole = input.isAdmin ? "admin" : "user";

  const rows = await sql`INSERT INTO users (telegram_id, name, username, status, role, last_login_at, login_count)
    VALUES (${input.telegramId}, ${input.name}, ${input.username}, ${status}, ${role}, now(), 1)
    ON CONFLICT (telegram_id) DO UPDATE SET
      name = EXCLUDED.name,
      username = EXCLUDED.username,
      last_login_at = now(),
      login_count = users.login_count + 1,
      role = CASE WHEN ${input.isAdmin} THEN 'admin' ELSE users.role END,
      status = CASE WHEN ${input.isAdmin} THEN 'approved' ELSE users.status END
    RETURNING *, (xmax = 0) AS created`;

  await sql`INSERT INTO login_events (telegram_id, ip, user_agent)
    VALUES (${input.telegramId}, ${input.ip}, ${input.userAgent.slice(0, 300)})`;

  const row = rows[0] as UserRow & { created: boolean };
  return { user: toUser(row), created: row.created };
}

export async function getUser(telegramId: string): Promise<DbUser | null> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM users WHERE telegram_id = ${telegramId}`;
  return rows[0] ? toUser(rows[0] as UserRow) : null;
}

export async function listUsers(): Promise<DbUser[]> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM users ORDER BY
    CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC LIMIT 500`;
  return (rows as UserRow[]).map(toUser);
}

export async function decideUser(
  telegramId: string,
  status: Exclude<AccessStatus, "pending">,
  decidedBy: string,
): Promise<DbUser | null> {
  await ensureSchema();
  const rows = await sql`UPDATE users SET status = ${status}, decided_at = now(), decided_by = ${decidedBy}
    WHERE telegram_id = ${telegramId} AND role <> 'admin' RETURNING *`;
  return rows[0] ? toUser(rows[0] as UserRow) : null;
}
