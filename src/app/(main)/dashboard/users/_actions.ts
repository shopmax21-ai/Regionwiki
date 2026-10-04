"use server";

import { revalidatePath } from "next/cache";

import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { decideUser, getUser, setUserRole } from "@/lib/auth/db";
import { notifyUserDecision } from "@/lib/auth/telegram";

export type ActionResult = { ok: true } | { ok: false; error: string };

const refresh = () => {
  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/access");
};

/** Одобрить или отклонить доступ. Права проверяются по базе, а не по cookie. */
export async function changeUserStatus(telegramId: string, status: "approved" | "rejected"): Promise<ActionResult> {
  const config = getAuthConfig();
  const admin = await getAdmin();
  if (!config || !admin) return { ok: false, error: "Нужны права администратора" };
  if (telegramId === admin.id) return { ok: false, error: "Нельзя менять доступ самому себе" };
  if (status !== "approved" && status !== "rejected") return { ok: false, error: "Неизвестное действие" };

  try {
    const user = await decideUser(telegramId, status, admin.id);
    if (!user) return { ok: false, error: "Пользователь не найден или является администратором" };
    await notifyUserDecision(config, user.telegramId, status === "approved");
  } catch (error) {
    console.error("[users] Не удалось изменить доступ", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }

  refresh();
  return { ok: true };
}

/** Назначить или снять роль администратора. Администраторов из настроек (TELEGRAM_ADMIN_IDS) снять нельзя. */
export async function changeUserRole(telegramId: string, role: "admin" | "user"): Promise<ActionResult> {
  const config = getAuthConfig();
  const admin = await getAdmin();
  if (!config || !admin) return { ok: false, error: "Нужны права администратора" };
  if (telegramId === admin.id) return { ok: false, error: "Нельзя менять роль самому себе" };
  if (role !== "admin" && role !== "user") return { ok: false, error: "Неизвестное действие" };
  if (role === "user" && config.adminIds.includes(telegramId)) {
    return { ok: false, error: "Этот администратор задан в настройках сервера, снять роль можно только там" };
  }

  try {
    const target = await getUser(telegramId);
    if (!target) return { ok: false, error: "Пользователь не найден" };
    await setUserRole(telegramId, role, admin.id);
  } catch (error) {
    console.error("[users] Не удалось изменить роль", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }

  refresh();
  return { ok: true };
}
