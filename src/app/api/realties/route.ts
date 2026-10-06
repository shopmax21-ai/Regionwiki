import { type NextRequest, NextResponse } from "next/server";

import { actorOf, recordContentChange } from "@/lib/audit/store";
import { getAdmin } from "@/lib/auth/admin";
import { createRealty, RealtyStoreError } from "@/lib/realties/store";
import { validateRealty } from "@/lib/realties/validate";

export const dynamic = "force-dynamic";

/** Добавить объект недвижимости. Нужно право «Редактирование недвижимости». */
export async function POST(request: NextRequest) {
  const admin = await getAdmin("realty.edit");
  if (!admin) return NextResponse.json({ error: "Недостаточно прав для редактирования недвижимости" }, { status: 403 });

  // Только JSON: форма с другого сайта не сможет отправить такой запрос без CORS-проверки.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Ожидается JSON" }, { status: 415 });
  }

  const body = await request.json().catch(() => null);
  const result = validateRealty(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    await createRealty(result.realty, admin.id);
    await recordContentChange(actorOf(admin), "realty", "created", {
      id: result.realty.id,
      label: `${result.realty.category} №${result.realty.id}`,
    });
  } catch (error) {
    if (error instanceof RealtyStoreError && error.code === "exists") {
      return NextResponse.json({ error: "Объект с таким номером уже есть" }, { status: 409 });
    }
    console.error("[realties] Не удалось добавить", error);
    return NextResponse.json({ error: "База данных недоступна, попробуйте позже" }, { status: 503 });
  }

  return NextResponse.json({ realty: result.realty }, { status: 201 });
}
