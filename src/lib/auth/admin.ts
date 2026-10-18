import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthConfig } from "./config";
import { getCurrentUser } from "./current-user";
import { getGroupPermissions, getUser, getUserOverrides } from "./db";
import { type AdminGroup, effectivePermissions, groupLevel, isAdminGroup, type Permission } from "./groups";

export type AdminContext = {
  id: string;
  name: string;
  /** Игровой никнейм и Static ID из профиля (если указаны) */
  nickname: string | null;
  staticId: string | null;
  group: AdminGroup;
  level: number;
  permissions: Permission[];
};

/**
 * Администратор по данным из базы (группа и права могли измениться после выдачи сессии) или null.
 * Администраторы из TELEGRAM_ADMIN_IDS всегда считаются Гл.Администраторами.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await getCurrentUser();
  if (!session) return null;
  return getAdminContextById(session.id);
}

/** Контекст для отрисовки страниц: администратор из env может предпросматривать права выбранной группы. */
export async function getPageAdminContext(): Promise<AdminContext | null> {
  const admin = await getAdminContext();
  if (!admin || !(getAuthConfig()?.adminIds.includes(admin.id) ?? false)) return admin;

  const previewGroup = (await cookies()).get("role_preview")?.value;
  if (!isAdminGroup(previewGroup)) return admin;

  const permissions = (await getGroupPermissions())[previewGroup];
  return { ...admin, group: previewGroup, level: groupLevel(previewGroup), permissions };
}

/** Выбранная для просмотра группа, только для администратора из TELEGRAM_ADMIN_IDS. */
export async function getPagePreviewGroup(): Promise<AdminGroup | null> {
  const session = await getCurrentUser();
  if (!session || !(getAuthConfig()?.adminIds.includes(session.id) ?? false)) return null;
  const previewGroup = (await cookies()).get("role_preview")?.value;
  return isAdminGroup(previewGroup) ? previewGroup : null;
}

/** Администратор с правом в режиме предпросмотра. Для проверок изменений используйте getAdmin. */
export async function getPageAdmin(permission: Permission): Promise<AdminContext | null> {
  const context = await getPageAdminContext();
  return context?.permissions.includes(permission) ? context : null;
}

/** Тот же контекст по Telegram ID: нужен там, где нет сессии на сайте (например, личный токен оверлея). */
export async function getAdminContextById(telegramId: string): Promise<AdminContext | null> {
  try {
    const user = await getUser(telegramId);
    if (!user || user.status !== "approved") return null;

    const fromEnv = getAuthConfig()?.adminIds.includes(user.telegramId) ?? false;
    const group: AdminGroup | null = fromEnv ? "chief" : user.role === "admin" ? user.adminGroup : null;
    if (!group) return null;

    // Гл.Администратор всегда имеет все права, личные настройки на него не действуют
    const base = (await getGroupPermissions())[group];
    const permissions = group === "chief" ? base : effectivePermissions(base, await getUserOverrides(user.telegramId));
    return {
      id: user.telegramId,
      name: user.name,
      nickname: user.nickname,
      staticId: user.staticId,
      group,
      level: groupLevel(group),
      permissions,
    };
  } catch {
    return null;
  }
}

/** Может ли этот человек рассматривать заявки (кнопки «Одобрить» и «Отклонить» в боте). */
export async function canUserDecideAccess(telegramId: string): Promise<boolean> {
  try {
    if (getAuthConfig()?.adminIds.includes(telegramId)) return true;
    const user = await getUser(telegramId);
    if (!user || user.status !== "approved" || user.role !== "admin" || !user.adminGroup) return false;
    const base = (await getGroupPermissions())[user.adminGroup];
    const permissions =
      user.adminGroup === "chief" ? base : effectivePermissions(base, await getUserOverrides(user.telegramId));
    return permissions.includes("access.decide");
  } catch {
    return false;
  }
}

/** Администратор с нужным правом или null. Используйте при любых изменениях данных. */
export async function getAdmin(permission: Permission): Promise<AdminContext | null> {
  const context = await getAdminContext();
  return context?.permissions.includes(permission) ? context : null;
}

/** Права текущего посетителя для меню, поиска и кнопок. Пусто, если он не администратор. */
export async function getMyPermissions(): Promise<Permission[]> {
  const session = await getCurrentUser();
  if (session?.status !== "approved") return [];
  return (await getPageAdminContext())?.permissions ?? [];
}

export async function hasPermission(permission: Permission): Promise<boolean> {
  return (await getMyPermissions()).includes(permission);
}

/** Принадлежность к администрации и права посетителя за один запрос к базе: для меню и поиска. */
export async function getViewerAccess(): Promise<{ isAdmin: boolean; permissions: Permission[] }> {
  const session = await getCurrentUser();
  if (session?.status !== "approved") return { isAdmin: false, permissions: [] };
  const context = await getPageAdminContext();
  return { isAdmin: context !== null, permissions: context?.permissions ?? [] };
}

/**
 * Для страниц и layout разделов только для администрации: пускает любого администратора (хелпер и выше),
 * остальных отправляет на страницу «нет доступа». Без настроенной авторизации раздел закрыт для всех.
 */
export async function requireAdmin(): Promise<AdminContext> {
  if (!getAuthConfig()) redirect("/");
  const admin = await getAdminContext();
  if (!admin) redirect("/unauthorized");
  return admin;
}

/** Для рендеринга страниц с ролью предпросмотра, не меняет проверки серверных действий. */
export async function requirePageAdmin(): Promise<AdminContext> {
  if (!getAuthConfig()) redirect("/");
  const admin = await getPageAdminContext();
  if (!admin) redirect("/unauthorized");
  return admin;
}
