import { type NextRequest, NextResponse } from "next/server";

import { getAdmin } from "@/lib/auth/admin";
import { deleteRealty, RealtyStoreError, updateRealty } from "@/lib/realties/store";
import { validateRealty } from "@/lib/realties/validate";

export const dynamic = "force-dynamic";

const DENIED = { error: "Недостаточно прав для редактирования недвижимости" };
const NOT_FOUND = { error: "Объект не найден, возможно, его уже удалили" };

/** Изменить объект. Номер не меняется. Нужно право «Редактирование недвижимости». */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin("realty.edit");
  if (!admin) return NextResponse.json(DENIED, { status: 403 });

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Ожидается JSON" }, { status: 415 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = validateRealty(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  if (String(result.realty.id) !== id) {
    return NextResponse.json({ error: "Номер объекта изменить нельзя" }, { status: 400 });
  }

  try {
    await updateRealty(result.realty, admin.id);
  } catch (error) {
    if (error instanceof RealtyStoreError && error.code === "not_found") {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    console.error("[realties] Не удалось сохранить", error);
    return NextResponse.json({ error: "База данных недоступна, попробуйте позже" }, { status: 503 });
  }

  return NextResponse.json({ realty: result.realty });
}

/** Удалить объект. Нужно право «Редактирование недвижимости». */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin("realty.edit");
  if (!admin) return NextResponse.json(DENIED, { status: 403 });

  const { id } = await params;

  try {
    await deleteRealty(id);
  } catch (error) {
    if (error instanceof RealtyStoreError && error.code === "not_found") {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    console.error("[realties] Не удалось удалить", error);
    return NextResponse.json({ error: "База данных недоступна, попробуйте позже" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
