"use server";

import { revalidatePath } from "next/cache";

import { actorOf, recordContentChange } from "@/lib/audit/store";
import { getAdmin } from "@/lib/auth/admin";
import { createItem, deleteItem, ItemStoreError, listItems, updateItem } from "@/lib/items/store";
import { validateItem } from "@/lib/items/validate";

import type { Item } from "./_data/items";

export type ItemActionResult = { ok: true; item: Item } | { ok: false; error: string };
export type ItemDeleteResult = { ok: true } | { ok: false; error: string };

const DENIED = "Недостаточно прав для редактирования предметов";

function failure(error: unknown): string {
  if (error instanceof ItemStoreError) {
    if (error.code === "not_found") return "Предмет не найден, возможно, его уже удалили";
    if (error.code === "exists") return "Предмет с таким ID уже есть, укажите другой или оставьте поле пустым";
  }
  console.error("[items] Не удалось сохранить изменения", error);
  return "База данных недоступна, попробуйте позже";
}

const refresh = () => revalidatePath("/dashboard/items");

const badId = (id: unknown) => typeof id !== "number" || !Number.isInteger(id) || id < 1;

/** Добавить предмет. Нужно право «Редактирование предметов», оно проверяется по базе. */
export async function createItemAction(input: unknown): Promise<ItemActionResult> {
  const admin = await getAdmin("items.edit");
  if (!admin) return { ok: false, error: DENIED };

  const result = validateItem(input);
  if (!result.ok) return result;

  try {
    const item = await createItem(result.item, admin.id);
    await recordContentChange(actorOf(admin), "item", "created", { id: item.id, label: item.name });
    refresh();
    return { ok: true, item };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

/** Изменить предмет. ID не меняется. */
export async function updateItemAction(id: number, input: unknown): Promise<ItemActionResult> {
  const admin = await getAdmin("items.edit");
  if (!admin) return { ok: false, error: DENIED };
  if (badId(id)) return { ok: false, error: "Неизвестный предмет" };

  const result = validateItem(input);
  if (!result.ok) return result;

  try {
    const item = await updateItem(id, result.item, admin.id);
    await recordContentChange(actorOf(admin), "item", "updated", { id: item.id, label: item.name });
    refresh();
    return { ok: true, item };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export async function deleteItemAction(id: number): Promise<ItemDeleteResult> {
  const admin = await getAdmin("items.edit");
  if (!admin) return { ok: false, error: DENIED };
  if (badId(id)) return { ok: false, error: "Неизвестный предмет" };

  try {
    // Название запоминаем до удаления: после него его уже не найти
    const name = await listItems()
      .then(({ items }) => items.find((item) => item.id === id)?.name)
      .catch(() => undefined);
    await deleteItem(id);
    await recordContentChange(actorOf(admin), "item", "deleted", { id, label: name ?? `№${id}` });
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}
