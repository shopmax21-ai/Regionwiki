import { type NextRequest, NextResponse } from "next/server";

import { personPlainText } from "@/lib/auth/person";
import { authenticateOverlayUser } from "@/lib/overlay/user-auth";
import { listAssigned, listMine, listQueue } from "@/lib/punishments/store";
import {
  buildCommand,
  durationText,
  isCommandAvailable,
  kindText,
  needsDecision,
} from "@/lib/punishments/types";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Наказания для оверлея: GET /api/overlay/punishments
 * Нужен личный токен (Authorization: Bearer). Что вернётся, зависит от прав администратора:
 *  - очередь и «мои в работе» — с правом «Рассмотрение заявок на наказание»;
 *  - «мои заявки» — с правом «Подача заявок на наказание».
 * Это те же данные, что видны на сайте, ничего сверх.
 */
export async function GET(request: NextRequest) {
  const admin = await authenticateOverlayUser(request);
  if (!admin) return NextResponse.json({ ok: false, error: "Неверный личный токен" }, { status: 401, headers: NO_STORE });

  const canReview = admin.permissions.includes("punishments.review");
  const canRequest = admin.permissions.includes("punishments.request");
  const canAll = admin.permissions.includes("punishments.all");

  try {
    const [queue, assigned, mine] = await Promise.all([
      canReview ? listQueue() : Promise.resolve([]),
      canReview ? listAssigned(admin.id) : Promise.resolve([]),
      canRequest ? listMine(admin.id, 25) : Promise.resolve([]),
    ]);

    return NextResponse.json(
      {
        ok: true,
        serverTime: new Date().toISOString(),
        me: { id: admin.id, name: admin.name, canReview, canRequest, canAll },
        queue: queue.map((item) => ({
          id: item.id,
          number: item.number,
          staticId: item.staticId,
          kind: kindText(item),
          duration: durationText(item),
          rules: item.rules,
          forum: item.forum,
          requester: personPlainText(item.requester),
          evidenceCount: item.evidenceCount,
          createdAt: item.createdAt,
        })),
        assigned: assigned.map((item) => ({
          id: item.id,
          number: item.number,
          staticId: item.staticId,
          kind: kindText(item),
          duration: durationText(item),
          rules: item.rules,
          forum: item.forum,
          requester: personPlainText(item.requester),
          evidence: item.evidence,
          status: item.status,
          needsDecision: needsDecision(item),
          // Команда доступна, когда заявка одобрена или доказательств нет: как на сайте
          command: isCommandAvailable(item) ? buildCommand(item) : null,
          copied: item.copiedAt !== null,
          createdAt: item.createdAt,
        })),
        mine: mine.map((item) => ({
          id: item.id,
          number: item.number,
          staticId: item.staticId,
          kind: kindText(item),
          duration: durationText(item),
          status: item.status,
          decisionNote: item.decisionNote,
          assignee: item.assignee ? personPlainText(item.assignee) : null,
          createdAt: item.createdAt,
        })),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[overlay] Не удалось получить наказания", error);
    return NextResponse.json({ ok: false, error: "База данных недоступна" }, { status: 503, headers: NO_STORE });
  }
}
