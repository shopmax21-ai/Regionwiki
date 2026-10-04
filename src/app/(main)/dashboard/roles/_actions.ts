"use server";

import { revalidatePath } from "next/cache";

import { getAdmin } from "@/lib/auth/admin";
import { setGroupPermission } from "@/lib/auth/db";
import { isEditableGroup, isToggleablePermission } from "@/lib/auth/groups";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Включить или выключить право у группы. Нужно право «Изменение прав групп», оно есть только у Гл.Администратора. */
export async function setGroupPermissionAction(
  group: string,
  permission: string,
  enabled: boolean,
): Promise<ActionResult> {
  const admin = await getAdmin("permissions.edit");
  if (!admin) return { ok: false, error: "Права групп может менять только Гл.Администратор" };
  if (!isEditableGroup(group) || !isToggleablePermission(permission) || typeof enabled !== "boolean") {
    return { ok: false, error: "Это право изменить нельзя" };
  }

  try {
    await setGroupPermission(group, permission, enabled);
  } catch (error) {
    console.error("[roles] Не удалось сохранить право", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }

  // Меню и страницы зависят от прав, поэтому сбрасываем весь кабинет
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
