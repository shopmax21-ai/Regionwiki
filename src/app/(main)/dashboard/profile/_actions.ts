"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getAdminContext } from "@/lib/auth/admin";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getUser,
  groupOfUser,
  revokeSessions,
  setNotifyRequests,
  setUserIdentity,
  setUserIdentityOnce,
} from "@/lib/auth/db";
import { groupLevel } from "@/lib/auth/groups";
import { identityLocked, validateFirstIdentity, validateIdentity } from "@/lib/auth/identity";
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
 * Указать свои Никнейм и Static ID. Только для администраторов и только один раз: на сайте они показываются вместо
 * имени из Telegram («иконка роли Никнейм иконка ID Статик»). Потом их меняет только вышестоящий администратор
 * (saveStaffIdentity).
 */
export async function saveIdentity(input: unknown): Promise<ActionResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: "Никнейм и Static ID указывают администраторы" };
  if (identityLocked(admin)) {
    return { ok: false, error: "Никнейм и Static ID уже указаны. Изменить их может только вышестоящий администратор" };
  }

  const fields = (typeof input === "object" && input !== null ? input : {}) as {
    nickname?: unknown;
    staticId?: unknown;
  };
  const parsed = validateFirstIdentity(fields);
  if (!parsed.ok) return parsed;

  try {
    const saved = await setUserIdentityOnce(admin.id, parsed.value.nickname, parsed.value.staticId);
    if (!saved) {
      return {
        ok: false,
        error: "Никнейм и Static ID уже указаны. Изменить их может только вышестоящий администратор",
      };
    }
  } catch (error) {
    console.error("[profile] Не удалось сохранить Никнейм и Static ID", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }

  // Имя показывается в боковом меню и во всех разделах, поэтому обновляем весь дашборд
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/**
 * Изменить Никнейм и Static ID другого администратора. Доступно только тому, кто стоит выше него по группе.
 * Пустое поле очищает значение: если очистить оба, человек сможет указать их заново.
 */
export async function saveStaffIdentity(targetId: unknown, input: unknown): Promise<ActionResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: "Только для администраторов" };
  if (typeof targetId !== "string" || !/^\d{1,20}$/.test(targetId) || targetId === admin.id) {
    return { ok: false, error: "Неизвестный администратор" };
  }

  const fields = (typeof input === "object" && input !== null ? input : {}) as {
    nickname?: unknown;
    staticId?: unknown;
  };
  const parsed = validateIdentity(fields);
  if (!parsed.ok) return parsed;

  try {
    const target = await getUser(targetId);
    const group = target ? groupOfUser(target) : null;
    if (!target || !group) return { ok: false, error: "Администратор не найден" };
    // Уровень проверяется по базе в момент сохранения, а не по тому, что видела страница
    if (admin.level <= groupLevel(group)) {
      return { ok: false, error: "Менять данные может только вышестоящий администратор" };
    }
    await setUserIdentity(targetId, parsed.value.nickname, parsed.value.staticId);
  } catch (error) {
    console.error("[profile] Не удалось сохранить Никнейм и Static ID администратора", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }

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
