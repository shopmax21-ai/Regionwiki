"use server";

import { revalidatePath } from "next/cache";

import { getAdmin } from "@/lib/auth/admin";
import { createMapPlace, deleteMapPlace, MapStoreError, updateMapPlace } from "@/lib/map/store";
import { validatePlace } from "@/lib/map/validate";

export type PlaceActionResult = { ok: true; id: string } | { ok: false; error: string };

const DENIED = { ok: false, error: "Недостаточно прав для редактирования карты" } as const;
const UNKNOWN = { ok: false, error: "Неизвестная метка" } as const;

const isValidId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

function failure(error: unknown): PlaceActionResult {
  if (error instanceof MapStoreError && error.code === "not_found") {
    return { ok: false, error: "Метка не найдена, возможно, её уже удалили" };
  }
  console.error("[map] Не удалось сохранить изменения", error);
  return { ok: false, error: "База данных недоступна, попробуйте позже" };
}

/** Добавить метку. Нужно право «Редактирование карты», оно проверяется по базе. */
export async function createPlaceAction(input: unknown): Promise<PlaceActionResult> {
  const admin = await getAdmin("map.edit");
  if (!admin) return DENIED;

  const result = validatePlace(input);
  if (!result.ok) return result;

  try {
    const id = await createMapPlace(result.place, admin.id);
    revalidatePath("/dashboard/map");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

export async function updatePlaceAction(id: string, input: unknown): Promise<PlaceActionResult> {
  const admin = await getAdmin("map.edit");
  if (!admin) return DENIED;
  if (!isValidId(id)) return UNKNOWN;

  const result = validatePlace(input);
  if (!result.ok) return result;

  try {
    await updateMapPlace(id, result.place, admin.id);
    revalidatePath("/dashboard/map");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

export async function deletePlaceAction(id: string): Promise<PlaceActionResult> {
  const admin = await getAdmin("map.edit");
  if (!admin) return DENIED;
  if (!isValidId(id)) return UNKNOWN;

  try {
    await deleteMapPlace(id);
    revalidatePath("/dashboard/map");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}
