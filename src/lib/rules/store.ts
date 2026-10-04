import { type ChangelogEntry, type RuleChange, type RuleGroup, ruleGroups, type SyncStatus } from "@/app/(main)/dashboard/rules/_components/rules-meta";
import { getPool } from "@/lib/db/pool";

/**
 * Хранилище автообновления правил в Postgres:
 *  - rule_articles   — актуальный текст каждой статьи, как он на форуме (заменяет встроенный из _content);
 *  - rule_changes    — история изменений («было / стало» по пунктам);
 *  - rule_sync_runs  — журнал проверок (время, результат, ошибки).
 * Если DATABASE_URL не задан или база недоступна, сайт показывает встроенные тексты, а история берётся из rules-meta.ts.
 */

const SCHEMA_LOCK_ID = 727_003;
const SYNC_LOCK_ID = 727_002;
const OVERRIDES_TTL_MS = 15_000;

export const hasRulesDatabase = () => Boolean(process.env.DATABASE_URL);

export type StoredArticle = {
  slug: string;
  group: RuleGroup;
  rawText: string;
  hash: string;
  updatedLabel: string | null;
};

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS rule_articles (
      slug          text PRIMARY KEY,
      grp           text NOT NULL,
      raw_text      text NOT NULL,
      content_hash  text NOT NULL,
      forum_url     text,
      updated_label text,
      checked_at    timestamptz NOT NULL DEFAULT now(),
      changed_at    timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS rule_changes (
      id          bigserial PRIMARY KEY,
      slug        text NOT NULL,
      grp         text NOT NULL,
      change_date text NOT NULL,
      detected_at timestamptz NOT NULL DEFAULT now(),
      changes     jsonb NOT NULL
    )`);
    await client.query("CREATE INDEX IF NOT EXISTS rule_changes_detected_idx ON rule_changes (detected_at DESC, id DESC)");
    await client.query(`CREATE TABLE IF NOT EXISTS rule_sync_runs (
      id          bigserial PRIMARY KEY,
      started_at  timestamptz NOT NULL,
      finished_at timestamptz NOT NULL DEFAULT now(),
      ok          boolean NOT NULL,
      checked     integer NOT NULL DEFAULT 0,
      seeded      integer NOT NULL DEFAULT 0,
      changed     integer NOT NULL DEFAULT 0,
      errors      jsonb NOT NULL DEFAULT '[]'::jsonb
    )`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[rules] ROLLBACK failed", rollbackError));
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

async function query<T extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureReady();
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

function toStored(row: Record<string, unknown>): StoredArticle {
  return {
    slug: String(row.slug),
    group: row.grp as RuleGroup,
    rawText: String(row.raw_text),
    hash: String(row.content_hash),
    updatedLabel: (row.updated_label as string | null) ?? null,
  };
}

/** Все сохранённые статьи (для синхронизации, без кеша). */
export async function listStoredArticles(): Promise<Map<string, StoredArticle>> {
  const rows = await query("SELECT slug, grp, raw_text, content_hash, updated_label FROM rule_articles");
  return new Map(rows.map((row) => [String(row.slug), toStored(row)]));
}

let overridesCache: { at: number; value: Map<string, StoredArticle> } | null = null;
let warned = false;

/** Тексты из базы для показа на сайте. Любая ошибка → пустой набор, то есть сайт покажет встроенные тексты. */
export async function loadOverrides(): Promise<Map<string, StoredArticle>> {
  if (!hasRulesDatabase()) return new Map();
  if (overridesCache && Date.now() - overridesCache.at < OVERRIDES_TTL_MS) return overridesCache.value;
  try {
    const value = await listStoredArticles();
    overridesCache = { at: Date.now(), value };
    warned = false;
    return value;
  } catch (error) {
    if (!warned) console.error("[rules] База недоступна, показываю встроенные тексты правил", error);
    warned = true;
    return overridesCache?.value ?? new Map();
  }
}

export function invalidateRulesCache(): void {
  overridesCache = null;
}

/** Версия всего набора правил: меняется, когда меняется любой текст. Нужна поиску, чтобы пересобрать индекс. */
export async function getRulesVersion(): Promise<string> {
  const overrides = await loadOverrides();
  return [...overrides.values()]
    .map((item) => `${item.slug}:${item.hash}`)
    .sort()
    .join(",");
}

export type ArticleWrite = {
  slug: string;
  group: RuleGroup;
  rawText: string;
  hash: string;
  url: string;
  /** Дата изменения («04.10.2026»). Не задана — оставляем прежнюю. */
  updatedLabel?: string;
  change?: { date: string; changes: RuleChange[] };
};

/** Сохраняет текст статьи и запись в истории одной транзакцией: либо оба, либо ничего. */
export async function writeArticle(write: ArticleWrite): Promise<void> {
  await ensureReady();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO rule_articles (slug, grp, raw_text, content_hash, forum_url, updated_label, checked_at, changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), CASE WHEN $6::text IS NULL THEN NULL ELSE now() END)
       ON CONFLICT (slug) DO UPDATE SET
         grp = EXCLUDED.grp,
         raw_text = EXCLUDED.raw_text,
         content_hash = EXCLUDED.content_hash,
         forum_url = EXCLUDED.forum_url,
         updated_label = COALESCE(EXCLUDED.updated_label, rule_articles.updated_label),
         checked_at = now(),
         changed_at = CASE WHEN EXCLUDED.updated_label IS NULL THEN rule_articles.changed_at ELSE now() END`,
      [write.slug, write.group, write.rawText, write.hash, write.url, write.updatedLabel ?? null],
    );
    if (write.change && write.change.changes.length > 0) {
      await client.query("INSERT INTO rule_changes (slug, grp, change_date, changes) VALUES ($1, $2, $3, $4::jsonb)", [
        write.slug,
        write.group,
        write.change.date,
        JSON.stringify(write.change.changes),
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[rules] ROLLBACK failed", rollbackError));
    throw error;
  } finally {
    client.release();
  }
}

export async function touchArticles(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return;
  await query("UPDATE rule_articles SET checked_at = now() WHERE slug = ANY($1::text[])", [slugs]);
}

export type RunRecord = {
  startedAt: Date;
  ok: boolean;
  checked: number;
  seeded: number;
  changed: number;
  errors: string[];
};

export async function recordRun(run: RunRecord): Promise<void> {
  await query(
    "INSERT INTO rule_sync_runs (started_at, ok, checked, seeded, changed, errors) VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
    [run.startedAt, run.ok, run.checked, run.seeded, run.changed, JSON.stringify(run.errors)],
  );
  await query("DELETE FROM rule_sync_runs WHERE id < (SELECT COALESCE(MAX(id), 0) - 500 FROM rule_sync_runs)");
}

/**
 * Выполняет fn, только если другой экземпляр сервиса сейчас не синхронизирует правила.
 * Блокировка держится на отдельном соединении и снимается при любом исходе.
 */
export async function withSyncLock<T>(fn: () => Promise<T>): Promise<{ locked: true } | { locked: false; value: T }> {
  await ensureReady();
  const client = await getPool().connect();
  try {
    const result = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [SYNC_LOCK_ID]);
    if (!result.rows[0]?.ok) return { locked: true };
    try {
      return { locked: false, value: await fn() };
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [SYNC_LOCK_ID]).catch((error) => console.error("[rules] unlock failed", error));
    }
  } finally {
    client.release();
  }
}

const sectionTitles: Record<RuleGroup, string> = {
  general: "Основные правила",
  government: "Государственные структуры",
};

/** Записи истории из базы, новые сверху. Статьи, которых нет в rules-meta.ts, пропускаются. */
export async function listChangelogFromDb(limit = 200): Promise<ChangelogEntry[]> {
  const rows = await query(
    "SELECT slug, grp, change_date, changes FROM rule_changes ORDER BY detected_at DESC, id DESC LIMIT $1",
    [limit],
  );
  const entries: ChangelogEntry[] = [];
  for (const row of rows) {
    const group = row.grp as RuleGroup;
    const meta = ruleGroups[group]?.articles.find((article) => article.slug === row.slug);
    if (!meta) continue;
    entries.push({
      date: String(row.change_date),
      title: meta.title,
      section: sectionTitles[group],
      group,
      slug: meta.slug,
      changes: row.changes as RuleChange[],
    });
  }
  return entries;
}

export async function getLastRun(): Promise<SyncStatus> {
  if (!hasRulesDatabase()) return { lastChecked: null, ok: true };
  try {
    const rows = await query("SELECT finished_at, ok FROM rule_sync_runs ORDER BY id DESC LIMIT 1");
    const row = rows[0];
    if (!row) return { lastChecked: null, ok: true };
    const label = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(new Date(row.finished_at as string | Date))
      .replace(" г.", "");
    return { lastChecked: `${label} МСК`, ok: Boolean(row.ok) };
  } catch (error) {
    console.error("[rules] Не удалось прочитать журнал проверок", error);
    return { lastChecked: null, ok: true };
  }
}
