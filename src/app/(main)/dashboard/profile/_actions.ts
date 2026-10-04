"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { revokeSessions, setNotifyRequests } from "@/lib/auth/db";
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
