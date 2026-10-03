import { type NextRequest, NextResponse } from "next/server";

import { searchSite } from "@/lib/search/site-search";
import { MIN_QUERY_LENGTH, type SearchResponse } from "@/lib/search/types";

export const dynamic = "force-dynamic";

/** Поиск по всем разделам. Открыт без авторизации. */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 30) : 6;

  if (query.length < MIN_QUERY_LENGTH) {
    const empty: SearchResponse = { query, total: 0, groups: [] };
    return NextResponse.json(empty);
  }

  const { total, groups } = searchSite(query, limit);
  const body: SearchResponse = { query, total, groups };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=30" } });
}
