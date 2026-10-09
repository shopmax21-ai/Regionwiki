import { type NextRequest, NextResponse } from "next/server";

import { type RuleGroup, ruleGroups } from "@/app/(main)/(dashboard)/rules/_components/rules-meta";
import { clientIp, isSameOrigin } from "@/lib/auth/request";
import { isSemanticSearchEnabled, searchRulesSemantic } from "@/lib/rules/embeddings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMIT_PER_MINUTE = 20;
const WINDOW_MS = 60_000;

// Каждый запрос тратит деньги на embedding API, поэтому число запросов с одного адреса ограничено.
const recent = new Map<string, number[]>();

function tooManyRequests(ip: string): boolean {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 5000) {
    for (const [key, value] of recent) if (value.every((time) => now - time >= WINDOW_MS)) recent.delete(key);
  }
  return times.length > LIMIT_PER_MINUTE;
}

/** Поиск правил по смыслу: GET /api/rules/semantic?q=меня ограбили на улице&group=general */
export async function GET(request: NextRequest) {
  if (!isSemanticSearchEnabled()) return NextResponse.json({ enabled: false, hits: [] });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const group = request.nextUrl.searchParams.get("group") ?? "";
  if (query.length < 3 || !(group in ruleGroups)) return NextResponse.json({ enabled: true, hits: [] });

  if (tooManyRequests(clientIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "30" } });
  }

  try {
    const hits = await searchRulesSemantic(query, group as RuleGroup);
    return NextResponse.json({ enabled: true, hits }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.warn("[rules-embeddings] Сбой поиска по смыслу", error);
    return NextResponse.json({ error: "semantic_failed" }, { status: 502 });
  }
}
