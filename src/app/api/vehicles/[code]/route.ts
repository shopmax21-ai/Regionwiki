import { type NextRequest, NextResponse } from "next/server";

import { getAdmin } from "@/lib/auth/admin";
import { deleteVehicle, updateVehicle, VehicleStoreError } from "@/lib/vehicles/store";
import { validateVehicle } from "@/lib/vehicles/validate";

export const dynamic = "force-dynamic";

/** Изменить транспорт. Код (адрес страницы) не меняется. Нужно право «Редактирование транспорта». */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const admin = await getAdmin("transport.edit");
  if (!admin) return NextResponse.json({ error: "Недостаточно прав для редактирования транспорта" }, { status: 403 });

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Ожидается JSON" }, { status: 415 });
  }

  const { code } = await params;
  const body = await request.json().catch(() => null);
  const result = validateVehicle(body && typeof body === "object" ? { ...body, code } : body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    await updateVehicle(result.vehicle, admin.id);
  } catch (error) {
    if (error instanceof VehicleStoreError && error.code === "not_found") {
      return NextResponse.json({ error: "Транспорт не найден" }, { status: 404 });
    }
    console.error("[vehicles] Не удалось сохранить", error);
    return NextResponse.json({ error: "База данных недоступна, попробуйте позже" }, { status: 503 });
  }

  return NextResponse.json({ vehicle: result.vehicle });
}

/** Удалить транспорт. Нужно право «Редактирование транспорта». */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const admin = await getAdmin("transport.edit");
  if (!admin) return NextResponse.json({ error: "Недостаточно прав для редактирования транспорта" }, { status: 403 });

  const { code } = await params;

  try {
    await deleteVehicle(code);
  } catch (error) {
    if (error instanceof VehicleStoreError && error.code === "not_found") {
      return NextResponse.json({ error: "Транспорт не найден, возможно, его уже удалили" }, { status: 404 });
    }
    console.error("[vehicles] Не удалось удалить", error);
    return NextResponse.json({ error: "База данных недоступна, попробуйте позже" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
