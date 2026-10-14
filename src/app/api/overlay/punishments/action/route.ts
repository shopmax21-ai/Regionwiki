import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { authenticateOverlayUser } from "@/lib/overlay/user-auth";
import { auditDecision } from "@/lib/punishments/audit";
import {
  approveRequest,
  claimRequest,
  issueRequest,
  markCopied,
  PunishmentStoreError,
  rejectRequest,
  releaseRequest,
  setForum,
} from "@/lib/punishments/store";
import { normalizeForum, noteSchema } from "@/lib/punishments/validate";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const MESSAGES = {
  not_found: "Заявка не найдена",
  taken: "Эту заявку уже взял другой администратор или её статус изменился",
  forbidden: "Это действие доступно только администратору, который взял заявку",
  state: "В текущем статусе заявки это действие недоступно",
  not_copied: "Сначала скопируйте команду",
  own: "Нельзя рассматривать собственную заявку",
  database: "База данных недоступна, попробуйте позже",
} as const;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

/**
 * Действия над заявкой из оверлея: POST /api/overlay/punishments/action
 * Тело: { id, action: "claim" | "release" | "approve" | "reject" | "copied" | "issue" | "forum", note?, forum? }.
 * Права и правила те же, что у кнопок на сайте (store проверяет, кто взял заявку и в каком она статусе),
 * решения попадают в журнал аудита так же, как с сайта.
 */
export async function POST(request: NextRequest) {
  const admin = await authenticateOverlayUser(request);
  if (!admin) return fail("Неверный личный токен", 401);

  let body: { id?: unknown; action?: unknown; note?: unknown; forum?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Некорректный запрос");
  }

  const id = body.id;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return fail("Неизвестная заявка");

  const actor = { id: admin.id, name: admin.name };
  const chief = admin.permissions.includes("punishments.all");
  const reviewer = admin.permissions.includes("punishments.review");
  if (!reviewer && !chief) return fail("Недостаточно прав", 403);

  try {
    switch (body.action) {
      case "claim":
        if (!reviewer) return fail("Недостаточно прав", 403);
        await claimRequest(id, actor);
        break;
      case "release":
        await releaseRequest(id, actor, chief);
        break;
      case "approve":
        if (!reviewer) return fail("Недостаточно прав", 403);
        await approveRequest(id, actor);
        await auditDecision(actor, id, "approved");
        break;
      case "reject": {
        if (!reviewer) return fail("Недостаточно прав", 403);
        const parsed = noteSchema.safeParse(typeof body.note === "string" ? body.note : "");
        if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Некорректная причина");
        await rejectRequest(id, actor, parsed.data);
        await auditDecision(actor, id, "rejected", parsed.data);
        break;
      }
      case "forum": {
        if (!reviewer) return fail("Недостаточно прав", 403);
        const parsed = normalizeForum(body.forum);
        if (!parsed.ok) return fail(parsed.error);
        await setForum(id, actor, parsed.value);
        break;
      }
      case "copied":
        if (!reviewer) return fail("Недостаточно прав", 403);
        await markCopied(id, actor);
        break;
      case "issue":
        if (!reviewer) return fail("Недостаточно прав", 403);
        await issueRequest(id, actor);
        await auditDecision(actor, id, "issued");
        break;
      default:
        return fail("Неизвестное действие");
    }
  } catch (error) {
    if (error instanceof PunishmentStoreError) {
      if (error.code === "database") console.error("[overlay] Действие над заявкой не удалось", error.cause ?? error);
      return fail(MESSAGES[error.code], error.code === "database" ? 503 : 409);
    }
    console.error("[overlay] Действие над заявкой не удалось", error);
    return fail(MESSAGES.database, 503);
  }

  revalidatePath("/punishments", "layout");
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
