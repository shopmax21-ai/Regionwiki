import { type NextRequest, NextResponse } from "next/server";

import { businessCode } from "@/app/(main)/dashboard/business/_data/businesses";
import { actorOf, recordContentChange } from "@/lib/audit/store";
import { getAdmin } from "@/lib/auth/admin";
import { BusinessStoreError, createBusiness } from "@/lib/businesses/store";
import { validateBusiness } from "@/lib/businesses/validate";

export const dynamic = "force-dynamic";

/** Добавить бизнес. Нужно право «Редактирование бизнесов». */
export async function POST(request: NextRequest) {
  const admin = await getAdmin("business.edit");
  if (!admin) return NextResponse.json({ error: "Недостаточно прав для редактирования бизнесов" }, { status: 403 });

  // Только JSON: форма с другого сайта не сможет отправить такой запрос без CORS-проверки.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Ожидается JSON" }, { status: 415 });
  }

  const body = await request.json().catch(() => null);
  const result = validateBusiness(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    await createBusiness(result.business, admin.id);
    await recordContentChange(actorOf(admin), "business", "created", {
      id: businessCode(result.business),
      label: `${result.business.category} №${result.business.id}`,
    });
  } catch (error) {
    if (error instanceof BusinessStoreError && error.code === "exists") {
      return NextResponse.json({ error: "Бизнес с таким типом и номером уже есть" }, { status: 409 });
    }
    console.error("[businesses] Не удалось добавить", error);
    return NextResponse.json({ error: "База данных недоступна, попробуйте позже" }, { status: 503 });
  }

  return NextResponse.json({ business: result.business }, { status: 201 });
}
