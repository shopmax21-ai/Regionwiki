import { type NextRequest, NextResponse } from "next/server";

import { runRulesSync } from "@/lib/rules/sync";

import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Запуск проверки форума вручную или по внешнему расписанию (cron Railway, Vercel Cron, cron-job.org):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<сайт>/api/rules/sync
 * Без CRON_SECRET в production эндпоинт закрыт. Сам сайт и так проверяет форум раз в 3 часа (см. instrumentation.ts).
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await runRulesSync();
    const status = "skipped" in result && result.skipped === "no-database" ? 503 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    console.error("[rules-sync] Сбой проверки", error);
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
