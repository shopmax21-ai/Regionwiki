import { createHash, timingSafeEqual } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { getSearchIndex } from "@/app/(main)/(dashboard)/rules/_components/rules-content";
import { type RuleGroup, ruleGroups } from "@/app/(main)/(dashboard)/rules/_components/rules-meta";
import { listReplies } from "@/lib/replies/store";
import { getRulesVersion } from "@/lib/rules/store";

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
 * Правила открыты, как и на сайте. Быстрые ответы закрыты: отдаются только с заголовком X-Overlay-Token,
 * совпадающим с переменной окружения OVERLAY_TOKEN. Если переменная не задана, ответы не отдаются никому.
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

  const authorized = tokenMatches(request);
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
