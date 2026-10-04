"use server";

import { revalidatePath } from "next/cache";

import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import {
  clearUserOverrides,
  decideUser,
  getUser,
  getUserOverrides,
  setUserGroup,
  setUserOverride,
} from "@/lib/auth/db";
import {
  type AdminGroup,
  groupLevel,
  isAdminGroup,
  isPermissionOverride,
  isToggleablePermission,
  type Permission,
} from "@/lib/auth/groups";
import { notifyUserDecision } from "@/lib/auth/telegram";

import { toUserItem, type UserItem } from "./_lib";

export type ActionResult = { ok: true; user: UserItem } | { ok: false; error: string };

/**
 * Страница «Пользователи» обновляет список сама по ответу действия, поэтому её не перезагружаем.
 * Сбрасываем только соседние разделы, которые показывают те же данные.
 */
const refresh = () => {
  revalidatePath("/dashboard/access");
  revalidatePath("/dashboard/roles");
};

const DB_DOWN = "База данных недоступна, попробуйте позже";

/** Одобрить или отклонить доступ. Нужно право «Одобрение доступа», проверяется по базе, а не по cookie. */
export async function changeUserStatus(telegramId: string, status: "approved" | "rejected"): Promise<ActionResult> {
  const config = getAuthConfig();
  const admin = await getAdmin("access.decide");
  if (!config || !admin) return { ok: false, error: "Недостаточно прав" };
  if (telegramId === admin.id) return { ok: false, error: "Нельзя менять доступ самому себе" };
  if (status !== "approved" && status !== "rejected") return { ok: false, error: "Неизвестное действие" };

  try {
    const user = await decideUser(telegramId, status, admin.id);
    if (!user) return { ok: false, error: "Пользователь не найден или состоит в группе администраторов" };
    await notifyUserDecision(config, user.telegramId, status === "approved");
    refresh();
    return { ok: true, user: toUserItem(user) };
  } catch (error) {
    console.error("[users] Не удалось изменить доступ", error);
    return { ok: false, error: DB_DOWN };
  }
}

/**
 * Назначить группу администратора или снять её ("none"). Нужно право «Назначение групп».
 * Гл.Администратор может менять любые группы, остальные только те, что ниже их собственной.
 * Администраторов из TELEGRAM_ADMIN_IDS менять нельзя.
 */
export async function changeUserGroup(telegramId: string, group: AdminGroup | "none"): Promise<ActionResult> {
  const config = getAuthConfig();
  const admin = await getAdmin("groups.assign");
  if (!config || !admin) return { ok: false, error: "Недостаточно прав" };
  if (telegramId === admin.id) return { ok: false, error: "Нельзя менять группу самому себе" };
  if (group !== "none" && !isAdminGroup(group)) return { ok: false, error: "Неизвестная группа" };
  if (config.adminIds.includes(telegramId)) {
    return { ok: false, error: "Этот администратор задан в настройках сервера, изменить его можно только там" };
  }

  try {
    const target = await getUser(telegramId);
    if (!target) return { ok: false, error: "Пользователь не найден" };

    const newLevel = group === "none" ? 0 : groupLevel(group);
    if (admin.level < 4 && (groupLevel(target.adminGroup) >= admin.level || newLevel >= admin.level)) {
      return { ok: false, error: "Можно менять только группы ниже вашей" };
    }

    const updated = await setUserGroup(telegramId, group === "none" ? null : group, admin.id);
    if (!updated) return { ok: false, error: "Пользователь не найден" };
    refresh();
    return { ok: true, user: toUserItem(updated, await getUserOverrides(telegramId)) };
  } catch (error) {
    console.error("[users] Не удалось изменить группу", error);
    return { ok: false, error: DB_DOWN };
  }
}

/**
 * Выдать право лично, отозвать его или вернуть «как у группы» (null). Нужно право «Назначение групп».
 * Менять можно только администраторов ниже своей группы. Выдать можно лишь то право, которое есть у самого.
 */
export async function changeUserPermission(
  telegramId: string,
  permission: Permission,
  mode: "grant" | "deny" | null,
): Promise<ActionResult> {
  const config = getAuthConfig();
  const admin = await getAdmin("groups.assign");
  if (!config || !admin) return { ok: false, error: "Недостаточно прав" };
  if (telegramId === admin.id) return { ok: false, error: "Нельзя менять права самому себе" };
  if (!isToggleablePermission(permission)) return { ok: false, error: "Это право изменить нельзя" };
  if (mode !== null && !isPermissionOverride(mode)) return { ok: false, error: "Неизвестное действие" };
  if (config.adminIds.includes(telegramId)) {
    return { ok: false, error: "Этот администратор задан в настройках сервера, изменить его можно только там" };
  }
  if (mode === "grant" && admin.level < 4 && !admin.permissions.includes(permission)) {
    return { ok: false, error: "Нельзя выдать право, которого нет у вас самих" };
  }

  try {
    const target = await getUser(telegramId);
    if (!target?.adminGroup) return { ok: false, error: "Личные права можно выдавать только администраторам" };
    if (target.adminGroup === "chief") return { ok: false, error: "У Гл.Администратора и так есть все права" };
    if (admin.level < 4 && groupLevel(target.adminGroup) >= admin.level) {
      return { ok: false, error: "Можно менять только пользователей ниже вашей группы" };
    }

    await setUserOverride(telegramId, permission, mode, admin.id);
    refresh();
    return { ok: true, user: toUserItem(target, await getUserOverrides(telegramId)) };
  } catch (error) {
    console.error("[users] Не удалось изменить личные права", error);
    return { ok: false, error: DB_DOWN };
  }
}

/** Сбросить все личные права до прав группы. Те же ограничения, что и у changeUserPermission. */
export async function resetUserPermissions(telegramId: string): Promise<ActionResult> {
  const config = getAuthConfig();
  const admin = await getAdmin("groups.assign");
  if (!config || !admin) return { ok: false, error: "Недостаточно прав" };
  if (telegramId === admin.id) return { ok: false, error: "Нельзя менять права самому себе" };
  if (config.adminIds.includes(telegramId)) {
    return { ok: false, error: "Этот администратор задан в настройках сервера, изменить его можно только там" };
  }

  try {
    const target = await getUser(telegramId);
    if (!target?.adminGroup) return { ok: false, error: "Личные права есть только у администраторов" };
    if (admin.level < 4 && groupLevel(target.adminGroup) >= admin.level) {
      return { ok: false, error: "Можно менять только пользователей ниже вашей группы" };
    }

    await clearUserOverrides(telegramId);
    refresh();
    return { ok: true, user: toUserItem(target) };
  } catch (error) {
    console.error("[users] Не удалось сбросить личные права", error);
    return { ok: false, error: DB_DOWN };
  }
}
