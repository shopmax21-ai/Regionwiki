import { getStaticSource } from "@/app/(main)/(dashboard)/rules/_components/rules-content";
import { type RuleGroup, ruleGroups } from "@/app/(main)/(dashboard)/rules/_components/rules-meta";
import { countRules, parseRules } from "@/app/(main)/(dashboard)/rules/_content/parse";

import { diffRules } from "./diff";
import { discoverThreads, extractRulesText, fetchForumHtml } from "./forum";
import {
  hasRulesDatabase,
  invalidateRulesCache,
  listStoredArticles,
  recordRun,
  touchArticles,
  withSyncLock,
  writeArticle,
} from "./store";
import { createHash } from "node:crypto";

/** Разделы форума, где лежат темы с правилами. Тема сопоставляется со статьёй по slug (он одинаковый на форуме и на сайте). */
export const FORUM_SOURCES: Record<RuleGroup, string> = {
  general: "https://forum.region.game/forums/obshchiye-pravila-proyekta.43/",
  government: "https://forum.region.game/forums/pravila-gosudarstvennykh-organizatsii.3/",
};

export const SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000;

/** Если после обновления пунктов стало меньше этой доли от прежнего, считаем, что сломался разбор, и ничего не применяем. */
const MIN_RULES_RATIO = 0.7;
const PAUSE_BETWEEN_REQUESTS_MS = 400;

export type SyncResult =
  | { skipped: "locked" | "no-database" }
  | { ok: boolean; checked: number; seeded: number; changed: number; unchanged: number; errors: string[] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function todayMoscow(): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function synchronize(): Promise<Exclude<SyncResult, { skipped: string }>> {
  const startedAt = new Date();
  const stored = await listStoredArticles();
  const errors: string[] = [];
  const untouched: string[] = [];
  let checked = 0;
  let seeded = 0;
  let changed = 0;

  for (const group of Object.keys(FORUM_SOURCES) as RuleGroup[]) {
    const listingUrl = FORUM_SOURCES[group];
    let threads: Map<string, string>;
    try {
      threads = discoverThreads(await fetchForumHtml(listingUrl), new URL(listingUrl).origin);
    } catch (error) {
      errors.push(`Раздел «${ruleGroups[group].title}»: ${message(error)}`);
      continue;
    }

    for (const article of ruleGroups[group].articles) {
      const url = threads.get(article.slug);
      if (!url) {
        errors.push(`«${article.title}»: тема не найдена в разделе форума`);
        continue;
      }

      try {
        await sleep(PAUSE_BETWEEN_REQUESTS_MS);
        const text = extractRulesText(await fetchForumHtml(url));
        checked += 1;

        const previous = stored.get(article.slug);
        const baseline = previous?.rawText ?? getStaticSource(article.slug) ?? "";
        const before = countRules(parseRules(baseline));
        const after = countRules(parseRules(text));
        if (before > 0 && after < before * MIN_RULES_RATIO) {
          errors.push(`«${article.title}»: на форуме найдено ${after} пунктов вместо ${before}, обновление пропущено`);
          continue;
        }

        const hash = sha256(text);
        if (!previous) {
          // Первая проверка: фиксируем текущий текст форума как точку отсчёта, историю не пишем.
          await writeArticle({ slug: article.slug, group, rawText: text, hash, url });
          seeded += 1;
        } else if (previous.hash === hash) {
          untouched.push(article.slug);
        } else {
          const changes = diffRules(previous.rawText, text);
          const date = todayMoscow();
          await writeArticle({
            slug: article.slug,
            group,
            rawText: text,
            hash,
            url,
            ...(changes.length > 0 ? { updatedLabel: date, change: { date, changes } } : {}),
          });
          if (changes.length > 0) changed += 1;
          else untouched.push(article.slug);
        }
      } catch (error) {
        errors.push(`«${article.title}»: ${message(error)}`);
      }
    }
  }

  await touchArticles(untouched);
  invalidateRulesCache();

  const ok = errors.length === 0;
  await recordRun({ startedAt, ok, checked, seeded, changed, errors });
  return { ok, checked, seeded, changed, unchanged: untouched.length, errors };
}

/** Одна проверка форума. Безопасно вызывать одновременно из нескольких мест: параллельный запуск пропускается. */
export async function runRulesSync(): Promise<SyncResult> {
  if (!hasRulesDatabase()) return { skipped: "no-database" };
  const outcome = await withSyncLock(synchronize);
  return outcome.locked ? { skipped: "locked" } : outcome.value;
}

function logResult(result: SyncResult) {
  if ("skipped" in result) {
    console.info(`[rules-sync] Пропущено: ${result.skipped}`);
    return;
  }
  const line = `[rules-sync] проверено ${result.checked}, изменено ${result.changed}, впервые сохранено ${result.seeded}`;
  if (result.errors.length > 0) console.warn(`${line}. Ошибки:\n - ${result.errors.join("\n - ")}`);
  else console.info(line);
}

/** Запускает проверку раз в 3 часа внутри процесса сайта (нужен постоянно работающий сервер, например Railway). */
export function startRulesScheduler(): void {
  const globalState = globalThis as unknown as { __rulesSyncStarted?: boolean };
  if (globalState.__rulesSyncStarted) return;
  globalState.__rulesSyncStarted = true;

  const run = () => {
    runRulesSync()
      .then(logResult)
      .catch((error) => console.error("[rules-sync] Сбой проверки", error));
  };
  setTimeout(run, 30_000).unref?.();
  setInterval(run, SYNC_INTERVAL_MS).unref?.();
}
