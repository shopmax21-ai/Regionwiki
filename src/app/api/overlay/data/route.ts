import { type NextRequest, NextResponse } from "next/server";

import { getSearchIndex } from "@/app/(main)/(dashboard)/rules/_components/rules-content";
import { type RuleGroup, ruleGroups } from "@/app/(main)/(dashboard)/rules/_components/rules-meta";
import { authenticateOverlayUser } from "@/lib/overlay/user-auth";
import { listReplies } from "@/lib/replies/store";
import { getRulesVersion } from "@/lib/rules/store";

import { createHash, timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

function tokenMatches(request: NextRequest): boolean {
  const expected = process.env.OVERLAY_TOKEN;
  const given = request.headers.get("x-overlay-token") ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Данные для оверлея поверх игры: GET /api/overlay/data
 * Правила открыты, как и на сайте. Быстрые ответы закрыты и отдаются:
 *  - по личному ключу оверлея (Authorization: Bearer rgo_…), если у администратора есть право просмотра ответов;
 *  - по общему X-Overlay-Token, совпадающему с OVERLAY_TOKEN (старые версии оверлея).
 * Если ничего не подошло, ответы не отдаются.
 */
export async function GET(request: NextRequest) {
  const groups = Object.keys(ruleGroups) as RuleGroup[];
  const rules = (await Promise.all(groups.map((group) => getSearchIndex(group)))).flat().map((rule) => ({
    group: rule.group,
    slug: rule.slug,
    tag: rule.tag ?? "",
    article: rule.articleTitle,
    section: rule.sectionTitle,
    number: rule.number,
    text: rule.text,
    items: rule.items,
    punishments: rule.punishments,
    notes: rule.notes,
  }));

  const user = await authenticateOverlayUser(request);
  const authorized = tokenMatches(request) || Boolean(user?.permissions.includes("replies.view"));
  const replies = authorized ? (await listReplies()).replies : null;

  return NextResponse.json(
    {
      version: createHash("sha1")
        .update(await getRulesVersion().catch(() => ""))
        .digest("hex")
        .slice(0, 16),
      generatedAt: new Date().toISOString(),
      rules,
      replies,
      repliesLocked: !authorized,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
