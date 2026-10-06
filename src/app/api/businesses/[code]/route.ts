import { type NextRequest, NextResponse } from "next/server";

import { businessCode } from "@/app/(main)/dashboard/business/_data/businesses";
import { getAdmin } from "@/lib/auth/admin";
import { BusinessStoreError, deleteBusiness, updateBusiness } from "@/lib/businesses/store";
import { validateBusiness } from "@/lib/businesses/validate";

export const dynamic = "force-dynamic";

const DENIED = { error: "Недостаточно прав для редактирования бизнесов" };
const NOT_FOUND = { error: "Бизнес не найден, возможно, его уже удалили" };

/** Изменить бизнес. Тип и номер (из них состоит код) не меняются. Нужно право «Редактирование бизнесов». */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const admin = await getAdmin("business.edit");
  if (!admin) return NextResponse.json(DENIED, { status: 403 });

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Ожидается JSON" }, { status: 415 });
  }

  const { code } = await params;
  const body = await request.json().catch(() => null);
  const result = validateBusiness(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  if (businessCode(result.business) !== code) {
    return NextResponse.json({ error: "Тип и номер бизнеса изменить нельзя" }, { status: 400 });
  }

  try {
    await updateBusiness(result.business, admin.id);
  } catch (error) {
    if (error instanceof BusinessStoreError && error.code === "not_found") {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    console.error("[businesses] Не удалось сохранить", error);
    return NextResponse.json({ error: "База данных недоступна, попробуйте позже" }, { status: 503 });
  }

  return NextResponse.json({ business: result.business });
}

/** Удалить бизнес. Нужно право «Редактирование бизнесов». */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const admin = await getAdmin("business.edit");
  if (!admin) return NextResponse.json(DENIED, { status: 403 });

  const { code } = await params;

  try {
    await deleteBusiness(code);
  } catch (error) {
    if (error instanceof BusinessStoreError && error.code === "not_found") {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    console.error("[businesses] Не удалось удалить", error);
    return NextResponse.json({ error: "База данных недоступна, попробуйте позже" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
