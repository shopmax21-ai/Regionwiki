import { createHash } from "node:crypto";

import { getSearchIndex } from "@/app/(main)/(dashboard)/rules/_components/rules-content";
import {
  formatRuleRef,
  type RuleGroup,
  type RuleSearchEntry,
  ruleExtraText,
  ruleGroups,
} from "@/app/(main)/(dashboard)/rules/_components/rules-meta";
import { getPool } from "@/lib/db/pool";

import { getRulesVersion, hasRulesDatabase } from "./store";

/**
 * Поиск правил по смыслу через embedding API.
 *
 * Подходит любой сервис с OpenAI-совместимым методом /embeddings: OpenAI, Voyage, Mistral, OpenRouter,
 * а также свой сервер (Ollama, vLLM, TEI). Настройки задаются переменными EMBEDDINGS_* (см. .env.example).
 *
 * Векторы пунктов считаются один раз и хранятся в Postgres (таблица rule_embeddings, расширение pgvector не нужно:
 * пунктов сотни, косинусное сходство считается в памяти за миллисекунды). При изменении текста пункта
 * пересчитывается только он. На каждый запрос посетителя уходит один короткий вызов API.
 */

const SCHEMA_LOCK_ID = 727_004;
const BATCH_SIZE = 64;
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_TEXT_LENGTH = 2000;
const QUERY_CACHE_SIZE = 300;
const QUERY_CACHE_TTL_MS = 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 60_000;
const RESULT_LIMIT = 12;
/** Результат должен быть не слабее лучшего больше чем на это значение сходства. */
const RELATIVE_CUTOFF = 0.12;
const DEFAULT_MIN_SCORE = 0.3;

export type SemanticHit = { slug: string; anchor: string; score: number };

type Config = {
  url: string;
  key: string;
  model: string;
  queryPrefix: string;
  documentPrefix: string;
  minScore: number;
};

function readConfig(): Config | null {
  const key = process.env.EMBEDDINGS_API_KEY?.trim();
  if (!key || !hasRulesDatabase()) return null;

  const minScore = Number(process.env.EMBEDDINGS_MIN_SCORE);
  return {
    url: process.env.EMBEDDINGS_API_URL?.trim() || "https://api.openai.com/v1/embeddings",
    key,
    model: process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-small",
    // Для моделей семейства e5 нужны приставки «query: » и «passage: »; для остальных пусто
    queryPrefix: process.env.EMBEDDINGS_QUERY_PREFIX ?? "",
    documentPrefix: process.env.EMBEDDINGS_DOCUMENT_PREFIX ?? "",
    minScore: Number.isFinite(minScore) && minScore > 0 && minScore < 1 ? minScore : DEFAULT_MIN_SCORE,
  };
}

/** Включён ли поиск по смыслу (задан EMBEDDINGS_API_KEY и есть база). */
export const isSemanticSearchEnabled = () => readConfig() !== null;

// ——— Вызов API ———

async function requestEmbeddings(config: Config, inputs: string[]): Promise<Float32Array[]> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.key}` },
    body: JSON.stringify({ model: config.model, input: inputs }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const details = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`Embedding API ответил ${response.status}: ${details}`);
  }

  const body = (await response.json()) as { data?: { index?: number; embedding?: number[] }[] };
  const rows = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (rows.length !== inputs.length || rows.some((row) => !Array.isArray(row.embedding))) {
    throw new Error("Embedding API вернул неожиданный ответ");
  }
  return rows.map((row) => normalize(row.embedding as number[]));
}

/** Единичная длина: тогда косинусное сходство равно скалярному произведению. */
function normalize(values: number[]): Float32Array {
  let sum = 0;
  for (const value of values) sum += value * value;
  const length = Math.sqrt(sum) || 1;
  return Float32Array.from(values, (value) => value / length);
}

function dot(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

// ——— Хранилище ———

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_LOCK_ID]);
        await client.query(`CREATE TABLE IF NOT EXISTS rule_embeddings (
          rule_key     text NOT NULL,
          model        text NOT NULL,
          content_hash text NOT NULL,
          embedding    real[] NOT NULL,
          updated_at   timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (rule_key, model)
        )`);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

// ——— Текст пункта для вектора ———

function embeddingText(entry: RuleSearchEntry): string {
  const parts = [
    `${entry.articleTitle}. ${entry.sectionTitle}.`,
    `${formatRuleRef(entry.tag, entry.number)}. ${entry.text}`,
    entry.punishments.length > 0 ? `Наказание: ${entry.punishments.join("; ")}.` : "",
    ruleExtraText(entry),
  ];
  return parts.filter(Boolean).join(" ").slice(0, MAX_TEXT_LENGTH);
}

const hashOf = (value: string) => createHash("sha1").update(value).digest("hex");

// ——— Индекс в памяти ———

type VectorEntry = { key: string; group: RuleGroup; slug: string; anchor: string; vector: Float32Array };
type VectorIndex = { signature: string; entries: VectorEntry[] };

const state = globalThis as unknown as {
  __ruleVectorIndex?: VectorIndex;
  __ruleVectorBuild?: Promise<VectorIndex>;
  __ruleVectorFailedAt?: number;
  __ruleQueryCache?: Map<string, { vector: Float32Array; at: number }>;
};

async function buildIndex(config: Config, signature: string): Promise<VectorIndex> {
  await ensureSchema();
  const groups = Object.keys(ruleGroups) as RuleGroup[];
  const entries = (await Promise.all(groups.map((group) => getSearchIndex(group)))).flat();

  const units = entries.map((entry) => {
    const text = embeddingText(entry);
    return {
      entry,
      key: `${entry.slug}#${entry.anchor}`,
      text: `${config.documentPrefix}${text}`,
      hash: hashOf(`${config.model}|${config.documentPrefix}|${text}`),
    };
  });

  const pool = getPool();
  const stored = await pool.query<{ rule_key: string; content_hash: string; embedding: number[] }>(
    "SELECT rule_key, content_hash, embedding FROM rule_embeddings WHERE model = $1",
    [config.model],
  );
  const known = new Map(stored.rows.map((row) => [row.rule_key, row]));

  const vectors = new Map<string, Float32Array>();
  const missing: typeof units = [];
  for (const unit of units) {
    const row = known.get(unit.key);
    if (row && row.content_hash === unit.hash && row.embedding.length > 0) {
      vectors.set(unit.key, normalize(row.embedding.map(Number)));
    } else {
      missing.push(unit);
    }
  }

  for (let start = 0; start < missing.length; start += BATCH_SIZE) {
    const batch = missing.slice(start, start + BATCH_SIZE);
    const created = await requestEmbeddings(
      config,
      batch.map((unit) => unit.text),
    );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < batch.length; i++) {
        await client.query(
          `INSERT INTO rule_embeddings (rule_key, model, content_hash, embedding)
           VALUES ($1, $2, $3, $4::real[])
           ON CONFLICT (rule_key, model)
           DO UPDATE SET content_hash = EXCLUDED.content_hash, embedding = EXCLUDED.embedding, updated_at = now()`,
          [batch[i].key, config.model, batch[i].hash, Array.from(created[i])],
        );
        vectors.set(batch[i].key, created[i]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  // Удалённые из правил пункты больше не нужны
  await pool.query("DELETE FROM rule_embeddings WHERE model = $1 AND rule_key <> ALL($2::text[])", [
    config.model,
    units.map((unit) => unit.key),
  ]);

  return {
    signature,
    entries: units.flatMap((unit) => {
      const vector = vectors.get(unit.key);
      return vector
        ? [{ key: unit.key, group: unit.entry.group, slug: unit.entry.slug, anchor: unit.entry.anchor, vector }]
        : [];
    }),
  };
}

async function getIndex(config: Config): Promise<VectorIndex> {
  const signature = `${config.model}|${config.documentPrefix}|${await getRulesVersion()}`;
  if (state.__ruleVectorIndex?.signature === signature) return state.__ruleVectorIndex;

  const failedAt = state.__ruleVectorFailedAt;
  if (failedAt && Date.now() - failedAt < FAILURE_COOLDOWN_MS) throw new Error("Embedding API недавно не отвечал");

  // Один пересчёт на всех: параллельные запросы ждут один и тот же результат
  if (!state.__ruleVectorBuild) {
    state.__ruleVectorBuild = buildIndex(config, signature)
      .then((index) => {
        state.__ruleVectorIndex = index;
        state.__ruleVectorFailedAt = undefined;
        return index;
      })
      .catch((error) => {
        state.__ruleVectorFailedAt = Date.now();
        throw error;
      })
      .finally(() => {
        state.__ruleVectorBuild = undefined;
      });
  }
  return state.__ruleVectorBuild;
}

/** Прогревает векторы после обновления правил, чтобы первый посетитель не ждал. Ошибки только в лог. */
export function warmRuleEmbeddings(): void {
  const config = readConfig();
  if (!config) return;
  getIndex(config).catch((error) => console.warn("[rules-embeddings] Не удалось обновить векторы", error));
}

async function embedQuery(config: Config, query: string): Promise<Float32Array> {
  const cache = (state.__ruleQueryCache ??= new Map());
  const key = `${config.model}|${query}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < QUERY_CACHE_TTL_MS) return cached.vector;

  const [vector] = await requestEmbeddings(config, [`${config.queryPrefix}${query}`]);
  cache.set(key, { vector, at: Date.now() });
  if (cache.size > QUERY_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return vector;
}

/** Пункты группы правил, ближайшие по смыслу к запросу. Пустой список, если поиск по смыслу не настроен. */
export async function searchRulesSemantic(rawQuery: string, group: RuleGroup): Promise<SemanticHit[]> {
  const config = readConfig();
  if (!config) return [];

  const query = rawQuery.replace(/\s+/g, " ").trim().slice(0, 200).toLowerCase();
  if (query.length < 3) return [];

  const [index, queryVector] = await Promise.all([getIndex(config), embedQuery(config, query)]);
  const scored = index.entries
    .filter((entry) => entry.group === group)
    .map((entry) => ({ slug: entry.slug, anchor: entry.anchor, score: dot(entry.vector, queryVector) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.score ?? 0;
  const threshold = Math.max(config.minScore, best - RELATIVE_CUTOFF);
  return scored.filter((hit) => hit.score >= threshold).slice(0, RESULT_LIMIT);
}
