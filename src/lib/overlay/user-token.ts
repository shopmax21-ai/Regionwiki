import { createHash, randomBytes } from "node:crypto";

import { getPool } from "@/lib/db/pool";

/**
 * Личный ключ оверлея: единственное, что нужно ввести в приложении. Он создаётся в профиле, хранит в себе адрес сайта
 * (поэтому ссылку вводить не нужно) и открывает ровно то, что доступно этому администратору на сайте: правила,
 * быстрые ответы и наказания по его правам. Заявка привязана к конкретному администратору, поэтому общий OVERLAY_TOKEN
 * для этого не подходит. В базе лежит только хеш ключа, сам ключ показывается один раз; пересоздание отключает старый.
 *
 * Формат: rgo_<адрес сайта в base64url>.<секрет>
 */

const PREFIX = "rgo_";
const LOCK_ID = 727_011;

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS overlay_user_tokens (
      telegram_id  text PRIMARY KEY,
      token_hash   text NOT NULL UNIQUE,
      created_at   timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz
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

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type UserTokenInfo = { createdAt: string; lastUsedAt: string | null };

/** Создаёт новый ключ администратора, прежний перестаёт работать. Открытый ключ возвращается только здесь. */
export async function createUserToken(telegramId: string, origin: string): Promise<string> {
  await ensureReady();
  const token = `${PREFIX}${Buffer.from(origin, "utf8").toString("base64url")}.${randomBytes(32).toString("base64url")}`;
  await getPool().query(
    `INSERT INTO overlay_user_tokens (telegram_id, token_hash) VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, created_at = now(), last_used_at = NULL`,
    [telegramId, hashToken(token)],
  );
  return token;
}

export async function revokeUserToken(telegramId: string): Promise<void> {
  await ensureReady();
  await getPool().query("DELETE FROM overlay_user_tokens WHERE telegram_id = $1", [telegramId]);
}

export async function getUserTokenInfo(telegramId: string): Promise<UserTokenInfo | null> {
  try {
    await ensureReady();
    const { rows } = await getPool().query<{ created_at: Date; last_used_at: Date | null }>(
      "SELECT created_at, last_used_at FROM overlay_user_tokens WHERE telegram_id = $1",
      [telegramId],
    );
    if (!rows[0]) return null;
    return {
      createdAt: new Date(rows[0].created_at).toISOString(),
      lastUsedAt: rows[0].last_used_at ? new Date(rows[0].last_used_at).toISOString() : null,
    };
  } catch (error) {
    console.error("[overlay] Не удалось прочитать личный токен", error);
    return null;
  }
}

/** Telegram ID владельца токена или null. Время последнего использования обновляется не чаще раза в минуту. */
export async function findUserByToken(token: string): Promise<string | null> {
  if (!token.startsWith(PREFIX) || token.length > 400) return null;
  try {
    await ensureReady();
    const { rows } = await getPool().query<{ telegram_id: string }>(
      `UPDATE overlay_user_tokens SET last_used_at = now()
       WHERE token_hash = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute')
       RETURNING telegram_id`,
      [hashToken(token)],
    );
    if (rows[0]) return rows[0].telegram_id;
    const found = await getPool().query<{ telegram_id: string }>(
      "SELECT telegram_id FROM overlay_user_tokens WHERE token_hash = $1",
      [hashToken(token)],
    );
    return found.rows[0]?.telegram_id ?? null;
  } catch (error) {
    console.error("[overlay] Не удалось проверить личный токен", error);
    return null;
  }
}
