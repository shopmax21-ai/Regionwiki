import { type NextRequest, NextResponse } from "next/server";

import { actorOf, recordContentChange } from "@/lib/audit/store";
import { getAdmin } from "@/lib/auth/admin";
import { createVehicle, VehicleStoreError } from "@/lib/vehicles/store";
import { validateVehicle } from "@/lib/vehicles/validate";

export const dynamic = "force-dynamic";

/** Добавить транспорт. Нужно право «Редактирование транспорта». */
export async function POST(request: NextRequest) {
  const admin = await getAdmin("transport.edit");
  if (!admin) return NextResponse.json({ error: "Недостаточно прав для редактирования транспорта" }, { status: 403 });

  // Только JSON: форма с другого сайта не сможет отправить такой запрос без CORS-проверки.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Ожидается JSON" }, { status: 415 });
  }

  const body = await request.json().catch(() => null);
  const result = validateVehicle(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    await createVehicle(result.vehicle, admin.id);
    await recordContentChange(actorOf(admin), "vehicle", "created", {
      id: result.vehicle.code,
      label: result.vehicle.name,
    });
  } catch (error) {
    if (error instanceof VehicleStoreError && error.code === "exists") {
      return NextResponse.json({ error: "Транспорт с таким кодом уже есть" }, { status: 409 });
    }
    console.error("[vehicles] Не удалось добавить", error);
    return NextResponse.json({ error: "База данных недоступна, попробуйте позже" }, { status: 503 });
  }

  return NextResponse.json({ vehicle: result.vehicle }, { status: 201 });
}
