import type { AdminContext } from "@/lib/auth/admin";
import { getPeopleSafe } from "@/lib/auth/db";
import { personFromName, personPlainText } from "@/lib/auth/person";
import { getPool } from "@/lib/db/pool";

import {
  AUDIT_ENTITIES,
  type AuditCategory,
  type AuditEntity,
  type AuditEntry,
  type AuditSeverity,
  type AuditVerb,
  contentSummary,
  isAuditCategory,
  isAuditSeverity,
} from "./types";

/**
 * Журнал действий администрации в Postgres (таблица audit_log). Записи только добавляются: ни сайт, ни раздел
 * «Аудит» не умеют их менять или удалять. Запись в журнал никогда не ломает само действие: при сбое базы
 * ошибка уходит в логи сервера, а администратор получает обычный результат.
 */

const LOCK_ID = 727_007;
let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS audit_log (
      id           bigserial PRIMARY KEY,
      at           timestamptz NOT NULL DEFAULT now(),
      actor_id     text NOT NULL,
      actor_name   text NOT NULL,
      category     text NOT NULL,
      action       text NOT NULL,
      severity     text NOT NULL,
      target_type  text NOT NULL DEFAULT '',
      target_id    text NOT NULL DEFAULT '',
      target_label text NOT NULL DEFAULT '',
      summary      text NOT NULL,
      details      jsonb NOT NULL DEFAULT '{}'::jsonb
    )`);
    await client.query("CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC, id DESC)");
    await client.query("CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor_id, id DESC)");
    await client.query("CREATE INDEX IF NOT EXISTS audit_log_category_idx ON audit_log (category, id DESC)");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[audit] ROLLBACK failed", rollbackError));
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

/* Запись */

export type AuditInput = {
  category: AuditCategory;
  action: string;
  severity: AuditSeverity;
  summary: string;
  target?: { type: string; id?: string; label?: string };
  details?: Record<string, string>;
};

/** Кто совершил действие: хватает контекста администратора (или Telegram ID и имени, если это не страница сайта). */
export type AuditActor = { id: string; name: string };

export const actorOf = (admin: Pick<AdminContext, "id" | "name" | "nickname" | "staticId">): AuditActor => ({
  id: admin.id,
  name: personPlainText(admin),
});

const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

/** Записывает действие в журнал. Не бросает ошибок: сбой журнала не должен отменять само действие. */
export async function recordAudit(actor: AuditActor, input: AuditInput): Promise<void> {
  try {
    await ensureReady();
    const details = Object.fromEntries(
      Object.entries(input.details ?? {})
        .slice(0, 12)
        .map(([key, value]) => [clip(key, 60), clip(String(value), 400)]),
    );
    await getPool().query(
      `INSERT INTO audit_log (actor_id, actor_name, category, action, severity, target_type, target_id, target_label, summary, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        actor.id,
        clip(actor.name, 200),
        input.category,
        input.action,
        input.severity,
        input.target?.type ?? "",
        clip(input.target?.id ?? "", 120),
        clip(input.target?.label ?? "", 200),
        clip(input.summary, 400),
        JSON.stringify(details),
      ],
    );
  } catch (error) {
    console.error("[audit] Не удалось записать действие в журнал", error);
  }
}

/** Добавление, правка или удаление контента: фраза и важность подбираются сами. */
export const recordContentChange = (
  actor: AuditActor,
  entity: AuditEntity,
  verb: AuditVerb,
  target: { id?: string | number; label: string },
  details?: Record<string, string>,
) =>
  recordAudit(actor, {
    category: AUDIT_ENTITIES[entity].category,
    action: `${entity}.${verb}`,
    severity: verb === "deleted" ? "important" : "normal",
    summary: contentSummary(entity, verb, target.label),
    target: { type: entity, id: target.id === undefined ? undefined : String(target.id), label: target.label },
    details,
  });

/* Чтение */

export type AuditFilter = {
  category?: AuditCategory;
  severity?: AuditSeverity;
  actorId?: string;
  /** Текст из фразы или названия объекта */
  query?: string;
  /** Показать записи старше этого номера (постраничная загрузка) */
  before?: string;
  limit: number;
};

type Row = {
  id: string | number;
  at: string | Date;
  actor_id: string;
  actor_name: string;
  category: string;
  action: string;
  severity: string;
  target_type: string;
  target_id: string;
  target_label: string;
  summary: string;
  details: Record<string, unknown> | null;
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export type AuditPage = { entries: AuditEntry[]; hasMore: boolean; nextBefore: string | null };

export async function listAudit(filter: AuditFilter): Promise<AuditPage> {
  await ensureReady();

  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replaceAll("?", `$${params.length}`));
  };

  if (filter.category) add("category = ?", filter.category);
  if (filter.severity) add("severity = ?", filter.severity);
  if (filter.actorId) add("actor_id = ?", filter.actorId);
  if (filter.before && /^\d{1,19}$/.test(filter.before)) add("id < ?", filter.before);
  if (filter.query) {
    const pattern = `%${escapeLike(filter.query)}%`;
    add("(summary ILIKE ? OR target_label ILIKE ? OR actor_name ILIKE ?)", pattern);
  }

  params.push(filter.limit + 1);
  const { rows } = await getPool().query<Row>(
    `SELECT id, at, actor_id, actor_name, category, action, severity, target_type, target_id, target_label, summary, details
     FROM audit_log ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY id DESC LIMIT $${params.length}`,
    params,
  );

  const hasMore = rows.length > filter.limit;
  const page = rows.slice(0, filter.limit);
  const people = await getPeopleSafe(page.map((row) => row.actor_id));

  const entries = page.map<AuditEntry>((row) => ({
    id: String(row.id),
    at: new Date(row.at).toISOString(),
    actor: people.get(row.actor_id) ?? personFromName(row.actor_name, row.actor_id),
    category: isAuditCategory(row.category) ? row.category : "content",
    action: row.action,
    severity: isAuditSeverity(row.severity) ? row.severity : "normal",
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label,
    summary: row.summary,
    details: Object.fromEntries(Object.entries(row.details ?? {}).map(([key, value]) => [key, String(value)])),
  }));

  return { entries, hasMore, nextBefore: hasMore && entries.length > 0 ? entries[entries.length - 1].id : null };
}

/** Администраторы, которые есть в журнале: для списка в фильтре. */
export async function listAuditActors(): Promise<{ id: string; name: string }[]> {
  await ensureReady();
  const { rows } = await getPool().query<{ actor_id: string; actor_name: string }>(
    `SELECT DISTINCT ON (actor_id) actor_id, actor_name FROM audit_log ORDER BY actor_id, id DESC`,
  );
  return rows.map((row) => ({ id: row.actor_id, name: row.actor_name }));
}

export async function countAudit(): Promise<number> {
  await ensureReady();
  const { rows } = await getPool().query<{ n: string }>("SELECT count(*) AS n FROM audit_log");
  return Number(rows[0]?.n ?? 0);
}
