"use server";

import { revalidatePath } from "next/cache";

import { actorOf, recordAudit, recordContentChange } from "@/lib/audit/store";
import { getAdmin } from "@/lib/auth/admin";
import {
  createMapPlace,
  createMapPlaces,
  deleteMapPlace,
  listMapPlaces,
  MapStoreError,
  updateMapPlace,
} from "@/lib/map/store";
import { type PlaceInput, validatePlace } from "@/lib/map/validate";

import { IMPORT_MAX_ROWS } from "./_components/import-parse";

export type PlaceActionResult = { ok: true; id: string } | { ok: false; error: string };

const DENIED = { ok: false, error: "Недостаточно прав для редактирования карты" } as const;
const UNKNOWN = { ok: false, error: "Неизвестная метка" } as const;

const isValidId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

function failure(error: unknown): { ok: false; error: string } {
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
    await recordContentChange(actorOf(admin), "place", "created", { id, label: result.place.name });
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
    await recordContentChange(actorOf(admin), "place", "updated", { id, label: result.place.name });
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
    const name = await listMapPlaces()
      .then(({ places }) => places.find((place) => place.id === id)?.name)
      .catch(() => undefined);
    await deleteMapPlace(id);
    await recordContentChange(actorOf(admin), "place", "deleted", { id, label: name ?? id });
    revalidatePath("/dashboard/map");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

export type ImportActionResult = { ok: true; added: number; skipped: number } | { ok: false; error: string };

/**
 * Загрузить метки списком. Нужно то же право «Редактирование карты».
 * Каждая запись проверяется заново на сервере: данные из браузера доверия не заслуживают.
 */
export async function importPlacesAction(input: unknown): Promise<ImportActionResult> {
  const admin = await getAdmin("map.edit");
  if (!admin) return DENIED;

  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: "Нет меток для загрузки" };
  if (input.length > IMPORT_MAX_ROWS) {
    return { ok: false, error: `За один раз можно загрузить не больше ${IMPORT_MAX_ROWS} меток` };
  }

  const places: PlaceInput[] = [];
  for (const [index, item] of input.entries()) {
    const result = validatePlace(item);
    if (!result.ok) return { ok: false, error: `Метка ${index + 1}: ${result.error}` };
    places.push(result.place);
  }

  try {
    const { added, skipped } = await createMapPlaces(places, admin.id);
    if (added > 0) {
      await recordAudit(actorOf(admin), {
        category: "content",
        action: "place.imported",
        severity: "normal",
        summary: `Метки на карте загружены списком: добавлено ${added}`,
        target: { type: "place" },
        details: { Добавлено: String(added), Пропущено: String(skipped) },
      });
      revalidatePath("/dashboard/map");
    }
    return { ok: true, added, skipped };
  } catch (error) {
    return failure(error);
  }
}
