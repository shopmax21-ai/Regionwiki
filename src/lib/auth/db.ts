import { getPool } from "@/lib/db/pool";

import { getAuthConfig } from "./config";
import { AuthDependencyError } from "./errors";
import {
  type AdminGroup,
  allPermissions,
  defaultPermissions,
  type EditableGroup,
  editableGroups,
  isAdminGroup,
  isEditableGroup,
  isPermission,
  isPermissionOverride,
  isToggleablePermission,
  type Permission,
  type PermissionOverride,
  type PermissionOverrides,
  permissionDefs,
} from "./groups";
import type { Person } from "./person";
import type { AccessRole, AccessStatus } from "./session";

/** Любая ошибка запроса оборачивается, чтобы API мог отличить проблемы с базой от остальных. */
const sql = async (strings: TemplateStringsArray, ...params: unknown[]): Promise<Record<string, unknown>[]> => {
  try {
    const text = strings.reduce((acc, part, i) => acc + (i === 0 ? "" : `$${i}`) + part, "");
    const result = await getPool().query(text, params);
    return result.rows;
  } catch (error: unknown) {
    throw error instanceof AuthDependencyError ? error : new AuthDependencyError("database", error);
  }
};

/** Хост из DATABASE_URL без логина и пароля, чтобы его можно было писать в логи. */
export function databaseHost(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

/** Проверяет, что база отвечает. Бросает AuthDependencyError, если нет. */
export async function checkDatabase(): Promise<void> {
  await sql`SELECT 1`;
}

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
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_group text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_requests boolean NOT NULL DEFAULT true`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_calendar boolean NOT NULL DEFAULT false`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after timestamptz`;
    // Игровой профиль администратора: Никнейм и Static ID. Показываются на сайте вместо имени из Telegram.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS static_id text`;
    // Фон блока профиля: адрес загруженной картинки (/api/jobs/images/<хеш>)
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_background text`;
    // Администраторы, назначенные до появления групп, становятся Гл.Администраторами
    await sql`UPDATE users SET admin_group = 'chief' WHERE role = 'admin' AND admin_group IS NULL`;
    await sql`CREATE TABLE IF NOT EXISTS group_permissions (
      grp        text NOT NULL,
      permission text NOT NULL,
      enabled    boolean NOT NULL,
      PRIMARY KEY (grp, permission)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS user_permissions (
      telegram_id text NOT NULL,
      permission  text NOT NULL,
      mode        text NOT NULL,
      changed_by  text,
      changed_at  timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (telegram_id, permission)
    )`;
    // Недостающие права добавляются со значениями по умолчанию, уже настроенные не трогаются
    for (const group of editableGroups) {
      for (const def of permissionDefs) {
        if (def.locked) continue;
        await sql`INSERT INTO group_permissions (grp, permission, enabled)
          VALUES (${group}, ${def.key}, ${defaultPermissions[group].includes(def.key)})
          ON CONFLICT (grp, permission) DO NOTHING`;
      }
    }
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
  /** Группа администратора. У обычных участников null. */
  adminGroup: AdminGroup | null;
  /** Присылать ли в Telegram уведомления о новых заявках на доступ (для тех, кто может их рассматривать) */
  notifyRequests: boolean;
  /** Следить ли за календарём: сообщения в Telegram о мероприятиях и напоминания за час до начала */
  notifyCalendar: boolean;
  /** Игровой никнейм администратора (не указан: null) */
  nickname: string | null;
  /** Static ID администратора (не указан: null) */
  staticId: string | null;
  /** Фон блока профиля: адрес картинки или null */
  profileBackground: string | null;
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
  admin_group: string | null;
  notify_requests: boolean;
  notify_calendar: boolean;
  nickname: string | null;
  static_id: string | null;
  profile_background: string | null;
  created_at: string;
  decided_at: string | null;
  last_login_at: string | null;
  login_count: number;
};

/** Фоном может быть только картинка из нашего хранилища: другой адрес в базе не показываем. */
export const PROFILE_BACKGROUND_PATTERN = /^\/api\/jobs\/images\/[a-f0-9]{64}$/;

const safeBackground = (value: string | null | undefined): string | null =>
  value && PROFILE_BACKGROUND_PATTERN.test(value) ? value : null;

const toUser = (row: UserRow): DbUser => ({
  telegramId: row.telegram_id,
  name: row.name,
  username: row.username,
  status: row.status,
  role: row.role,
  adminGroup: isAdminGroup(row.admin_group) ? row.admin_group : row.role === "admin" ? "chief" : null,
  notifyRequests: row.notify_requests !== false,
  notifyCalendar: row.notify_calendar === true,
  nickname: row.nickname ?? null,
  staticId: row.static_id ?? null,
  profileBackground: safeBackground(row.profile_background),
  createdAt: new Date(row.created_at),
  decidedAt: row.decided_at ? new Date(row.decided_at) : null,
  lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
  loginCount: row.login_count,
});

/* ---------- Попытки входа (ссылка на бота → код) ---------- */

export async function countRecentAttempts(ip: string): Promise<number> {
  await ensureSchema();
  const rows =
    await sql`SELECT count(*)::int AS n FROM login_attempts WHERE ip = ${ip} AND created_at > now() - interval '1 minute'`;
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
  const row = rows[0] as
    | { telegram_id: string | null; consumed: boolean; attempts: number; expired: boolean }
    | undefined;
  return row
    ? { telegramId: row.telegram_id, consumed: row.consumed, expired: row.expired, attempts: row.attempts }
    : null;
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
  await ensureSchema();
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
}): Promise<{ user: DbUser; created: boolean; loginId: string }> {
  await ensureSchema();
  const status: AccessStatus = input.isAdmin ? "approved" : "pending";
  const role: AccessRole = input.isAdmin ? "admin" : "user";

  const rows =
    await sql`INSERT INTO users (telegram_id, name, username, status, role, admin_group, last_login_at, login_count)
    VALUES (${input.telegramId}, ${input.name}, ${input.username}, ${status}, ${role}, ${input.isAdmin ? "chief" : null}, now(), 1)
    ON CONFLICT (telegram_id) DO UPDATE SET
      name = EXCLUDED.name,
      username = EXCLUDED.username,
      last_login_at = now(),
      login_count = users.login_count + 1,
      role = CASE WHEN ${input.isAdmin} THEN 'admin' ELSE users.role END,
      admin_group = CASE WHEN ${input.isAdmin} THEN 'chief' ELSE users.admin_group END,
      status = CASE WHEN ${input.isAdmin} THEN 'approved' ELSE users.status END
    RETURNING *, (xmax = 0) AS created`;

  const events = await sql`INSERT INTO login_events (telegram_id, ip, user_agent)
    VALUES (${input.telegramId}, ${input.ip}, ${input.userAgent.slice(0, 300)}) RETURNING id`;

  const row = rows[0] as UserRow & { created: boolean };
  return { user: toUser(row), created: row.created, loginId: String((events[0] as { id: string | number }).id) };
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

/** Назначить группу администратора (null снимает её). Новый администратор сразу получает одобренный доступ. */
export async function setUserGroup(
  telegramId: string,
  group: AdminGroup | null,
  changedBy: string,
): Promise<DbUser | null> {
  await ensureSchema();
  const rows = group
    ? await sql`UPDATE users SET role = 'admin', admin_group = ${group}, status = 'approved',
        decided_at = now(), decided_by = ${changedBy}
        WHERE telegram_id = ${telegramId} RETURNING *`
    : await sql`UPDATE users SET role = 'user', admin_group = NULL, decided_at = now(), decided_by = ${changedBy}
        WHERE telegram_id = ${telegramId} RETURNING *`;
  // Личные права привязаны к работе администратора: после снятия группы они не должны «вернуться» при новом назначении
  if (!group) await sql`DELETE FROM user_permissions WHERE telegram_id = ${telegramId}`;
  return rows[0] ? toUser(rows[0] as UserRow) : null;
}

/** Права всех групп. У Гл.Администратора всегда все права, остальные берутся из таблицы. */
export async function getGroupPermissions(): Promise<Record<AdminGroup, Permission[]>> {
  await ensureSchema();
  const rows = await sql`SELECT grp, permission FROM group_permissions WHERE enabled`;
  const result: Record<AdminGroup, Permission[]> = { helper: [], junior: [], admin: [], chief: [...allPermissions] };
  for (const row of rows as { grp: string; permission: string }[]) {
    if (isEditableGroup(row.grp) && isToggleablePermission(row.permission)) result[row.grp].push(row.permission);
  }
  return result;
}

export async function setGroupPermission(
  group: EditableGroup,
  permission: Permission,
  enabled: boolean,
): Promise<void> {
  await ensureSchema();
  await sql`INSERT INTO group_permissions (grp, permission, enabled) VALUES (${group}, ${permission}, ${enabled})
    ON CONFLICT (grp, permission) DO UPDATE SET enabled = EXCLUDED.enabled`;
}

export async function setNotifyRequests(telegramId: string, enabled: boolean): Promise<void> {
  await ensureSchema();
  await sql`UPDATE users SET notify_requests = ${enabled} WHERE telegram_id = ${telegramId}`;
}

export async function setNotifyCalendar(telegramId: string, enabled: boolean): Promise<void> {
  await ensureSchema();
  await sql`UPDATE users SET notify_calendar = ${enabled} WHERE telegram_id = ${telegramId}`;
}

/** Одобренные администраторы, включившие слежение за календарём. */
export async function listCalendarSubscribers(): Promise<DbUser[]> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM users WHERE role = 'admin' AND status = 'approved' AND notify_calendar = true`;
  return (rows as UserRow[]).map(toUser);
}

/** Все одобренные администраторы: им могут уходить уведомления о заявках. */
export async function listAdmins(): Promise<DbUser[]> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM users WHERE role = 'admin' AND status = 'approved'`;
  return (rows as UserRow[]).map(toUser);
}

/** «Выйти на всех устройствах»: все сессии, выданные до этого момента, перестают действовать. */
export async function revokeSessions(telegramId: string): Promise<void> {
  await ensureSchema();
  await sql`UPDATE users SET sessions_valid_after = now() WHERE telegram_id = ${telegramId}`;
}

/** Время (секунды Unix), раньше которого выданные сессии недействительны. 0, если выход со всех устройств не делали. */
export async function getSessionsValidAfter(telegramId: string): Promise<number> {
  await ensureSchema();
  const rows = await sql`SELECT extract(epoch FROM sessions_valid_after)::float8 AS t FROM users
    WHERE telegram_id = ${telegramId}`;
  return Number((rows[0] as { t: number | null } | undefined)?.t ?? 0);
}

export type LoginEvent = { id: string; createdAt: Date; ip: string | null; userAgent: string | null };

type LoginEventRow = { id: string | number; created_at: string; ip: string | null; user_agent: string | null };

const toLoginEvent = (row: LoginEventRow): LoginEvent => ({
  id: String(row.id),
  createdAt: new Date(row.created_at),
  ip: row.ip,
  userAgent: row.user_agent,
});

/** Одна запись входа. Фильтр по telegram_id не даёт открыть чужую запись по номеру. */
export async function getLoginEvent(telegramId: string, id: string): Promise<LoginEvent | null> {
  if (!/^\d{1,19}$/.test(id)) return null;
  await ensureSchema();
  const rows = await sql`SELECT id, created_at, ip, user_agent FROM login_events
    WHERE telegram_id = ${telegramId} AND id = ${id}`;
  return rows[0] ? toLoginEvent(rows[0] as LoginEventRow) : null;
}

export async function getLoginEvents(telegramId: string, limit = 8): Promise<LoginEvent[]> {
  await ensureSchema();
  const rows = await sql`SELECT id, created_at, ip, user_agent FROM login_events
    WHERE telegram_id = ${telegramId} ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  return (rows as LoginEventRow[]).map(toLoginEvent);
}

/* ---------- Личные права ---------- */

function collectOverrides(rows: Record<string, unknown>[]): Map<string, PermissionOverrides> {
  const result = new Map<string, PermissionOverrides>();
  for (const row of rows as { telegram_id: string; permission: string; mode: string }[]) {
    if (!isPermission(row.permission) || !isPermissionOverride(row.mode)) continue;
    const entry = result.get(row.telegram_id) ?? {};
    entry[row.permission] = row.mode;
    result.set(row.telegram_id, entry);
  }
  return result;
}

/** Личные права одного человека. */
export async function getUserOverrides(telegramId: string): Promise<PermissionOverrides> {
  await ensureSchema();
  const rows = await sql`SELECT telegram_id, permission, mode FROM user_permissions WHERE telegram_id = ${telegramId}`;
  return collectOverrides(rows).get(telegramId) ?? {};
}

/** Личные права всех, у кого они есть. */
export async function listUserOverrides(): Promise<Map<string, PermissionOverrides>> {
  await ensureSchema();
  return collectOverrides(await sql`SELECT telegram_id, permission, mode FROM user_permissions`);
}

/** Выдать или отозвать право лично. null возвращает право «как у группы». */
export async function setUserOverride(
  telegramId: string,
  permission: Permission,
  mode: PermissionOverride | null,
  changedBy: string,
): Promise<void> {
  await ensureSchema();
  if (mode === null) {
    await sql`DELETE FROM user_permissions WHERE telegram_id = ${telegramId} AND permission = ${permission}`;
    return;
  }
  await sql`INSERT INTO user_permissions (telegram_id, permission, mode, changed_by)
    VALUES (${telegramId}, ${permission}, ${mode}, ${changedBy})
    ON CONFLICT (telegram_id, permission) DO UPDATE SET mode = EXCLUDED.mode, changed_by = EXCLUDED.changed_by, changed_at = now()`;
}

/** Сбросить все личные права человека до прав его группы. */
export async function clearUserOverrides(telegramId: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM user_permissions WHERE telegram_id = ${telegramId}`;
}

/* ---------- Никнейм и Static ID ---------- */

/** Сохранить Никнейм и Static ID. null очищает поле. */
export async function setUserIdentity(
  telegramId: string,
  nickname: string | null,
  staticId: string | null,
): Promise<DbUser | null> {
  await ensureSchema();
  const rows = await sql`UPDATE users SET nickname = ${nickname}, static_id = ${staticId}
    WHERE telegram_id = ${telegramId} RETURNING *`;
  return rows[0] ? toUser(rows[0] as UserRow) : null;
}

/**
 * Первое указание Никнейма и Static ID самим администратором. Условие в запросе гарантирует «один раз» даже при
 * двух одновременных отправках: если поля уже заполнены, строка не обновится и вернётся null.
 */
export async function setUserIdentityOnce(
  telegramId: string,
  nickname: string,
  staticId: string,
): Promise<DbUser | null> {
  await ensureSchema();
  const rows = await sql`UPDATE users SET nickname = ${nickname}, static_id = ${staticId}
    WHERE telegram_id = ${telegramId} AND nickname IS NULL AND static_id IS NULL RETURNING *`;
  return rows[0] ? toUser(rows[0] as UserRow) : null;
}

/** Сохранить фон блока профиля. null убирает фон. */
export async function setUserBackground(telegramId: string, url: string | null): Promise<void> {
  if (url !== null && !PROFILE_BACKGROUND_PATTERN.test(url)) throw new Error("Недопустимый адрес фона");
  await ensureSchema();
  await sql`UPDATE users SET profile_background = ${url} WHERE telegram_id = ${telegramId}`;
}

/** Группа человека с учётом TELEGRAM_ADMIN_IDS: оттуда всегда Гл.Администраторы, как и при проверке прав. */
export function groupOfUser(user: Pick<DbUser, "telegramId" | "role" | "adminGroup">): AdminGroup | null {
  if (getAuthConfig()?.adminIds.includes(user.telegramId)) return "chief";
  return user.role === "admin" ? user.adminGroup : null;
}

export const toPerson = (user: DbUser): Person => ({
  id: user.telegramId,
  name: user.name,
  nickname: user.nickname,
  staticId: user.staticId,
  group: groupOfUser(user),
  background: user.profileBackground,
});

/**
 * Данные для отображения сразу по нескольким Telegram ID, одним запросом. Кого нет в базе, в результат не попадает:
 * вызывающий код подставляет запасной вариант из сохранённого имени.
 */
export async function getPeople(ids: readonly string[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter((id) => id !== ""))];
  const result = new Map<string, Person>();
  if (unique.length === 0) return result;
  await ensureSchema();
  const rows = await sql`SELECT * FROM users WHERE telegram_id = ANY(${unique}::text[])`;
  for (const row of rows as UserRow[]) {
    const user = toUser(row);
    result.set(user.telegramId, toPerson(user));
  }
  return result;
}

/** Безопасная загрузка: ошибка базы не ломает страницу, а возвращает пустую карту (останутся имена из Telegram). */
export async function getPeopleSafe(ids: readonly string[]): Promise<Map<string, Person>> {
  try {
    return await getPeople(ids);
  } catch (error) {
    console.error("[auth] Не удалось загрузить профили людей", error);
    return new Map();
  }
}
