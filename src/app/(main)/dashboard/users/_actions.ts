"use server";

import { revalidatePath } from "next/cache";

import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { decideUser, getUser, setUserGroup } from "@/lib/auth/db";
import { type AdminGroup, groupLevel, isAdminGroup } from "@/lib/auth/groups";
import { notifyUserDecision } from "@/lib/auth/telegram";

export type ActionResult = { ok: true } | { ok: false; error: string };

const refresh = () => {
  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/access");
  revalidatePath("/dashboard/roles");
};

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
  } catch (error) {
    console.error("[users] Не удалось изменить доступ", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }

  refresh();
  return { ok: true };
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

    await setUserGroup(telegramId, group === "none" ? null : group, admin.id);
  } catch (error) {
    console.error("[users] Не удалось изменить группу", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }

  refresh();
  return { ok: true };
}
