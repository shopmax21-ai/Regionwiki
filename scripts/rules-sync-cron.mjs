#!/usr/bin/env node
/**
 * Запуск фоновой проверки правил по расписанию (cron). Не зависит от Next.js и сборки: нужен только Node 18+.
 *
 *   SITE_URL=https://example.com CRON_SECRET=... node scripts/rules-sync-cron.mjs
 *
 * Переменные:
 *   SITE_URL (или RULES_SYNC_URL) — публичный адрес сайта без завершающего слэша;
 *   CRON_SECRET                   — тот же секрет, что задан у сайта;
 *   RULES_SYNC_TIMEOUT_SEC        — сколько ждать ответ (по умолчанию 150).
 *
 * Код выхода 0 — проверка выполнена или пропущена, потому что уже идёт другая; 1 — сбой или ошибки в разделах.
 */

const base = (process.env.RULES_SYNC_URL || process.env.SITE_URL || "").replace(/\/+$/, "");
const secret = process.env.CRON_SECRET;
const timeoutMs = (Number(process.env.RULES_SYNC_TIMEOUT_SEC) || 150) * 1000;

if (!base) {
  console.error("[rules-sync-cron] Не задан SITE_URL (или RULES_SYNC_URL).");
  process.exit(1);
}
if (!secret) {
  console.error("[rules-sync-cron] Не задан CRON_SECRET.");
  process.exit(1);
}

const url = `${base}/api/rules/sync`;

try {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = undefined;
  }

  if (!response.ok) {
    console.error(`[rules-sync-cron] ${url} ответил ${response.status}: ${text.slice(0, 300)}`);
    process.exit(1);
  }

  if (result && "skipped" in result) {
    console.log(`[rules-sync-cron] Пропущено: ${result.skipped}`);
    process.exit(0);
  }

  console.log(
    `[rules-sync-cron] проверено ${result?.checked ?? "?"}, изменено ${result?.changed ?? "?"}, впервые сверено ${result?.seeded ?? "?"}`,
  );
  if (result?.errors?.length) {
    console.error(`[rules-sync-cron] Ошибки:\n - ${result.errors.join("\n - ")}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`[rules-sync-cron] Не удалось вызвать ${url}:`, error instanceof Error ? error.message : error);
  process.exit(1);
}
