"use server";

import { revalidatePath } from "next/cache";

import { actorOf, recordContentChange } from "@/lib/audit/store";
import { getAdmin } from "@/lib/auth/admin";
import {
  createMediaPrEntry,
  deleteMediaPrEntry,
  MediaPrStoreError,
  setMediaPrInfo,
  updateMediaPrEntry,
} from "@/lib/mediapr/store";
import { validateMediaPr, validateMediaPrInfo } from "@/lib/mediapr/validate";

export type MediaPrResult = { ok: true; id?: string } | { ok: false; error: string };

const DENIED = { ok: false, error: "Недостаточно прав для редактирования раздела" } as const;
const DATABASE = { ok: false, error: "База данных недоступна, попробуйте позже" } as const;
const GONE = { ok: false, error: "Запись не найдена, возможно, её уже удалили" } as const;
const ID_PATTERN = /^[0-9a-f-]{36}$/i;

function failure(error: unknown): MediaPrResult {
  if (error instanceof MediaPrStoreError && error.code === "not_found") return GONE;
  console.error("[media-pr] Сбой при сохранении", error);
  return DATABASE;
}

export async function createMediaPrAction(input: unknown): Promise<MediaPrResult> {
  const admin = await getAdmin("mediapr.edit");
  if (!admin) return DENIED;
  const result = validateMediaPr(input);
  if (!result.ok) return result;

  try {
    const id = await createMediaPrEntry(result.entry, admin.id);
    await recordContentChange(actorOf(admin), "media_pr", "created", { id, label: result.entry.name });
    revalidatePath("/media-pr");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

export async function updateMediaPrAction(id: string, input: unknown): Promise<MediaPrResult> {
  const admin = await getAdmin("mediapr.edit");
  if (!admin) return DENIED;
  if (!ID_PATTERN.test(id)) return GONE;
  const result = validateMediaPr(input);
  if (!result.ok) return result;

  try {
    await updateMediaPrEntry(id, result.entry, admin.id);
    await recordContentChange(actorOf(admin), "media_pr", "updated", { id, label: result.entry.name });
    revalidatePath("/media-pr");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteMediaPrAction(id: string): Promise<MediaPrResult> {
  const admin = await getAdmin("mediapr.edit");
  if (!admin) return DENIED;
  if (!ID_PATTERN.test(id)) return GONE;

  try {
    const name = await deleteMediaPrEntry(id);
    if (name === null) return GONE;
    await recordContentChange(actorOf(admin), "media_pr", "deleted", { id, label: name });
    revalidatePath("/media-pr");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Сохраняет справку раздела. Пустой текст возвращает справку по умолчанию. */
export async function saveMediaPrInfoAction(input: unknown): Promise<MediaPrResult> {
  const admin = await getAdmin("mediapr.edit");
  if (!admin) return DENIED;
  const result = validateMediaPrInfo(input);
  if (!result.ok) return result;

  try {
    await setMediaPrInfo(result.text, admin.id);
    await recordContentChange(actorOf(admin), "media_pr", "updated", { id: "info", label: "Справка раздела" });
    revalidatePath("/media-pr");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
