import { revalidatePath } from "next/cache";
import { after, type NextRequest, NextResponse } from "next/server";

import { personPlainText } from "@/lib/auth/person";
import { authenticateOverlayUser } from "@/lib/overlay/user-auth";
import { notifyReviewers } from "@/lib/punishments/notify";
import { createRequest } from "@/lib/punishments/store";
import { validateRequest } from "@/lib/punishments/validate";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

/**
 * Подача заявки на наказание из оверлея: POST /api/overlay/punishments/request
 * Тело то же, что у формы на сайте: { staticId, kind, muteChannel?, duration, forum?, rules[], evidence[] }.
 * Нужен личный токен и право «Подача заявок на наказание». Проверка полей общая с сайтом, администраторам уходит
 * то же уведомление в Telegram.
 */
export async function POST(request: NextRequest) {
  const helper = await authenticateOverlayUser(request);
  if (!helper) return fail("Неверный личный токен", 401);
  if (!helper.permissions.includes("punishments.request")) return fail("Недостаточно прав для подачи заявок", 403);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return fail("Некорректный запрос");
  }

  const result = validateRequest(input);
  if (!result.ok) return fail(result.error);

  try {
    const created = await createRequest(result.value, { id: helper.id, name: helper.name });
    // Уведомление уходит после ответа: медленный Telegram не задерживает отправку заявки
    after(async () => {
      try {
        await notifyReviewers({
          number: created.number,
          requesterId: helper.id,
          requesterName: personPlainText(helper),
          staticId: result.value.staticId,
          kind: result.value.kind,
          muteChannel: result.value.muteChannel,
          duration: result.value.duration,
          forum: result.value.forum,
          rules: result.value.rules,
          evidenceCount: result.value.evidence.length,
        });
      } catch (error) {
        console.error("[overlay] Не удалось отправить уведомления о заявке", error);
      }
    });
    revalidatePath("/punishments", "layout");
    return NextResponse.json({ ok: true, number: created.number }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("[overlay] Не удалось создать заявку", error);
    return fail("База данных недоступна, попробуйте позже", 503);
  }
}
