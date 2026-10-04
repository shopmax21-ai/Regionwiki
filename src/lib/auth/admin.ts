import { getAuthConfig } from "./config";
import { getCurrentUser } from "./current-user";
import { getGroupPermissions, getUser, getUserOverrides } from "./db";
import { type AdminGroup, effectivePermissions, groupLevel, type Permission } from "./groups";

export type AdminContext = {
  id: string;
  name: string;
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

  try {
    const user = await getUser(session.id);
    if (!user || user.status !== "approved") return null;

    const fromEnv = getAuthConfig()?.adminIds.includes(user.telegramId) ?? false;
    const group: AdminGroup | null = fromEnv ? "chief" : user.role === "admin" ? user.adminGroup : null;
    if (!group) return null;

    // Гл.Администратор всегда имеет все права, личные настройки на него не действуют
    const base = (await getGroupPermissions())[group];
    const permissions = group === "chief" ? base : effectivePermissions(base, await getUserOverrides(user.telegramId));
    return { id: user.telegramId, name: user.name, group, level: groupLevel(group), permissions };
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
  return (await getAdminContext())?.permissions ?? [];
}

export async function hasPermission(permission: Permission): Promise<boolean> {
  return (await getMyPermissions()).includes(permission);
}
