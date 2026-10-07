import { cache } from "react";

import {
  type CalloutVariant,
  type GuideBlock,
  type GuideSection,
  type Job,
  jobs as seedJobs,
} from "@/app/(main)/(dashboard)/jobs/_data/jobs";
import { isInsideWorld, placeCategoryIds } from "@/app/(main)/(dashboard)/map/_components/map-data";
import { getPool } from "@/lib/db/pool";

import type { JobInput } from "./validate";

/**
 * Работы и их гайды хранятся в Postgres (таблица wiki_jobs, содержимое гайда лежит в jsonb-колонке data).
 * Таблица создаётся при первом обращении и заполняется встроенными работами из _data/jobs.ts только в момент создания:
 * если администраторы потом удалят все работы, они не вернутся.
 * Если базы нет или она недоступна, сайт показывает встроенные работы, а редактирование отключено.
 */

export class JobStoreError extends Error {
  constructor(
    readonly code: "not_found" | "exists" | "database",
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
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    const existed = await client.query("SELECT to_regclass('public.wiki_jobs') AS name");
    const isNew = existed.rows[0]?.name === null;
    await client.query(`CREATE TABLE IF NOT EXISTS wiki_jobs (
      slug text PRIMARY KEY,
      position bigserial NOT NULL,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text
    )`);
    if (isNew) {
      for (const job of seedJobs) {
        await client.query("INSERT INTO wiki_jobs (slug, data) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING", [
          job.slug,
          JSON.stringify(job),
        ]);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[jobs] ROLLBACK failed", rollbackError));
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

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const calloutVariantsList: readonly CalloutVariant[] = ["tip", "info", "warning"];

/** Блоки из jsonb: всё, что не похоже на блок, отбрасывается, чтобы испорченная запись не роняла страницу. */
function toBlocks(value: unknown): GuideBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((raw): GuideBlock[] => {
    if (!raw || typeof raw !== "object") return [];
    const block = raw as Record<string, unknown>;
    const text = typeof block.text === "string" ? block.text : "";
    switch (block.type) {
      case "heading":
        return text ? [{ type: "heading", text }] : [];
      case "text":
        return text ? [{ type: "text", text }] : [];
      case "list": {
        const items = strings(block.items);
        return items.length > 0 ? [{ type: "list", ordered: block.ordered === true, items }] : [];
      }
      case "callout": {
        const variant = calloutVariantsList.find((item) => item === block.variant) ?? "tip";
        return text ? [{ type: "callout", variant, text }] : [];
      }
      case "image":
        return typeof block.src === "string" && block.src
          ? [{ type: "image", src: block.src, caption: optionalString(block.caption) }]
          : [];
      case "slider": {
        const rawSlides = Array.isArray(block.slides) ? block.slides : [];
        const slides = rawSlides.flatMap((rawSlide) => {
          if (!rawSlide || typeof rawSlide !== "object") return [];
          const slide = rawSlide as Record<string, unknown>;
          const src = typeof slide.src === "string" ? slide.src : "";
          if (!src) return [];
          return [{ src, caption: optionalString(slide.caption) }];
        });
        return slides.length > 0 ? [{ type: "slider", slides }] : [];
      }
      case "textImage": {
        const src = typeof block.src === "string" && block.src ? block.src : undefined;
        if (!src && !text) return [];
        return [
          {
            type: "textImage",
            side: block.side === "left" ? "left" : "right",
            text,
            src,
            caption: optionalString(block.caption),
          },
        ];
      }
      case "map": {
        const rawPlaces = Array.isArray(block.places) ? block.places : [];
        const places = rawPlaces.flatMap((rawPlace) => {
          if (!rawPlace || typeof rawPlace !== "object") return [];
          const place = rawPlace as Record<string, unknown>;
          const name = typeof place.name === "string" ? place.name : "";
          if (!name || typeof place.x !== "number" || typeof place.y !== "number") return [];
          if (!isInsideWorld({ x: place.x, y: place.y })) return [];
          const category = placeCategoryIds.find((item) => item === place.category) ?? "other";
          return [
            {
              name,
              x: place.x,
              y: place.y,
              category,
              icon: optionalString(place.icon),
              description: optionalString(place.description),
            },
          ];
        });
        return places.length > 0 ? [{ type: "map", title: optionalString(block.title), places }] : [];
      }
      default:
        return [];
    }
  });
}

/** Собирает работу из jsonb, не доверяя форме данных: старые или испорченные записи не должны ронять страницу. */
function toJob(slug: string, raw: unknown): Job {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sections: GuideSection[] = Array.isArray(data.sections)
    ? data.sections.flatMap((section) => {
        if (!section || typeof section !== "object") return [];
        const { title, items } = section as { title?: unknown; items?: unknown };
        return typeof title === "string" && title ? [{ title, items: strings(items) }] : [];
      })
    : [];

  return {
    slug,
    title: typeof data.title === "string" ? data.title : slug,
    kind: data.kind === "illegal" ? "illegal" : "legal",
    level: typeof data.level === "number" && Number.isFinite(data.level) ? data.level : 0,
    altRanks: strings(data.altRanks),
    tagline: typeof data.tagline === "string" ? data.tagline : "",
    intro: typeof data.intro === "string" ? data.intro : "",
    conditions: strings(data.conditions),
    income: strings(data.income),
    process: strings(data.process),
    tips: strings(data.tips),
    teamwork: optionalString(data.teamwork),
    navigator: optionalString(data.navigator),
    image: optionalString(data.image),
    sections,
    blocks: toBlocks(data.blocks),
  };
}

/** Что сохраняется в базе: поля формы без служебных. */
function toData(input: JobInput): Omit<Job, "slug"> & { slug: string } {
  return {
    slug: input.slug,
    title: input.title,
    kind: input.kind,
    level: input.level,
    altRanks: input.altRanks.length > 0 ? input.altRanks : undefined,
    tagline: input.tagline,
    intro: input.intro,
    conditions: input.conditions,
    income: input.income,
    process: input.process,
    tips: input.tips,
    teamwork: input.teamwork,
    navigator: input.navigator,
    image: input.image,
    sections: input.sections.length > 0 ? input.sections : undefined,
    blocks: input.blocks,
  };
}

// Версия растёт при каждой записи: по ней поиск понимает, что индекс работ устарел.
let version = 0;
export const getJobsVersion = () => version;

/** problem — почему редактирование недоступно (null, если всё в порядке). Показывается только тем, у кого есть право. */
export type JobList = { jobs: Job[]; editable: boolean; problem: string | null };

// После сбоя базы недолго не обращаемся к ней: список работ нужен общему layout, и без паузы каждая страница
// ждала бы таймаут подключения.
const RETRY_AFTER_MS = 15_000;
let failure: { at: number; problem: string } | null = null;

async function loadJobs(): Promise<JobList> {
  if (!process.env.DATABASE_URL) {
    return { jobs: [...seedJobs], editable: false, problem: "не задана переменная DATABASE_URL" };
  }
  if (failure && Date.now() - failure.at < RETRY_AFTER_MS) {
    return { jobs: [...seedJobs], editable: false, problem: failure.problem };
  }
  try {
    await ensureReady();
    const { rows } = await getPool().query<{ slug: string; data: unknown }>(
      "SELECT slug, data FROM wiki_jobs ORDER BY position ASC",
    );
    failure = null;
    const all = rows.map((row) => toJob(row.slug, row.data));
    // Ссылки на удалённые работы убираем, чтобы форма и страницы не показывали «пустые» пути
    const known = new Set(all.map((job) => job.slug));
    for (const job of all) job.altRanks = job.altRanks?.filter((slug) => known.has(slug) && slug !== job.slug);
    return { jobs: all, editable: true, problem: null };
  } catch (error) {
    console.error("[jobs] База недоступна, показываем встроенные работы", error);
    const detail = error instanceof Error ? error.message : String(error);
    failure = { at: Date.now(), problem: detail.slice(0, 200) };
    return { jobs: [...seedJobs], editable: false, problem: failure.problem };
  }
}

/** Работы из базы. В пределах одного запроса к сайту (layout и страница) база опрашивается один раз. */
export const listJobs = cache(loadJobs);

async function run<T>(task: () => Promise<T>): Promise<T> {
  try {
    await ensureReady();
    const result = await task();
    version += 1;
    return result;
  } catch (error) {
    if (error instanceof JobStoreError) throw error;
    throw new JobStoreError("database", error);
  }
}

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === "23505";

export const createJob = (input: JobInput, updatedBy: string) =>
  run(async () => {
    try {
      await getPool().query("INSERT INTO wiki_jobs (slug, data, updated_by) VALUES ($1, $2, $3)", [
        input.slug,
        JSON.stringify(toData(input)),
        updatedBy,
      ]);
    } catch (error) {
      if (isUniqueViolation(error)) throw new JobStoreError("exists", error);
      throw error;
    }
  });

export const updateJob = (slug: string, input: JobInput, updatedBy: string) =>
  run(async () => {
    // Адрес гайда не меняется: на него ведут ссылки и пути «2 ранг на работе»
    const result = await getPool().query(
      "UPDATE wiki_jobs SET data = $2, updated_at = now(), updated_by = $3 WHERE slug = $1",
      [slug, JSON.stringify(toData({ ...input, slug })), updatedBy],
    );
    if (result.rowCount === 0) throw new JobStoreError("not_found");
  });

export const deleteJob = (slug: string, updatedBy: string) =>
  run(async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("DELETE FROM wiki_jobs WHERE slug = $1", [slug]);
      if (result.rowCount === 0) throw new JobStoreError("not_found");

      // Убираем удалённую работу из альтернативных путей других работ
      const linked = await client.query<{ slug: string; data: Record<string, unknown> }>(
        "SELECT slug, data FROM wiki_jobs WHERE data -> 'altRanks' @> to_jsonb($1::text)",
        [slug],
      );
      for (const row of linked.rows) {
        const rest = strings(row.data.altRanks).filter((item) => item !== slug);
        const next = { ...row.data, altRanks: rest.length > 0 ? rest : undefined };
        await client.query("UPDATE wiki_jobs SET data = $2, updated_at = now(), updated_by = $3 WHERE slug = $1", [
          row.slug,
          JSON.stringify(next),
          updatedBy,
        ]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch((rollbackError) => console.error("[jobs] ROLLBACK failed", rollbackError));
      throw error;
    } finally {
      client.release();
    }
  });
