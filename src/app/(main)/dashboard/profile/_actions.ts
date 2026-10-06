"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getAdminContext } from "@/lib/auth/admin";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { revokeSessions, setNotifyRequests, setUserIdentity } from "@/lib/auth/db";
import { validateIdentity } from "@/lib/auth/identity";
import { forgetRevocation } from "@/lib/auth/revocation";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Включить или выключить свои уведомления о новых заявках в Telegram. */
export async function setRequestNotifications(enabled: boolean): Promise<ActionResult> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Войдите заново" };
  if (typeof enabled !== "boolean") return { ok: false, error: "Неизвестное значение" };

  try {
    await setNotifyRequests(session.id, enabled);
  } catch (error) {
    console.error("[profile] Не удалось сохранить настройку уведомлений", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }

  revalidatePath("/dashboard/profile");
  return { ok: true };
}

/**
 * Сохранить свой Никнейм и Statik ID. Только для администраторов: на сайте они показываются вместо имени из Telegram
 * («иконка роли Никнейм иконка ID Статик»). Пустое поле очищает значение.
 */
export async function saveIdentity(input: unknown): Promise<ActionResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: "Никнейм и Statik ID указывают администраторы" };

  const fields = (typeof input === "object" && input !== null ? input : {}) as {
    nickname?: unknown;
    staticId?: unknown;
  };
  const parsed = validateIdentity(fields);
  if (!parsed.ok) return parsed;

  try {
    await setUserIdentity(admin.id, parsed.value.nickname, parsed.value.staticId);
  } catch (error) {
    console.error("[profile] Не удалось сохранить Никнейм и Statik ID", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }

  // Имя показывается в боковом меню и во всех разделах, поэтому обновляем весь дашборд
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/**
 * Завершить все сессии, включая эту. Сессии на других устройствах перестанут действовать сразу
 * (в течение нескольких секунд), для входа понадобится новый код из Telegram.
 */
export async function logoutEverywhere(): Promise<ActionResult> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Вы уже вышли" };

  try {
    await revokeSessions(session.id);
  } catch (error) {
    console.error("[profile] Не удалось завершить сессии", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }

  forgetRevocation(session.id);
  (await cookies()).delete(SESSION_COOKIE);
  return { ok: true };
}
