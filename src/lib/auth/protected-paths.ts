/**
 * Разделы, для которых нужен вход и одобрение администратора. Всё остальное открыто без авторизации.
 * Чтобы закрыть новый раздел или страницу, добавьте сюда её путь (действует и на вложенные страницы).
 * Закрытые разделы также скрываются из меню и поиска у тех, кто не вошёл.
 */
export const PROTECTED_PATHS: readonly string[] = [
  "/dashboard/profile",
  "/dashboard/users",
  "/dashboard/access",
  "/dashboard/roles",
  "/dashboard/replies",
];

export const isProtectedPath = (pathname: string) =>
  PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/**
 * Разделы, которые видят только администраторы с нужным правом (остальным они не показываются в меню и поиске,
 * а сама страница проверяет право ещё раз). Права настраиваются в разделе «Роли и права».
 */
export const PATH_PERMISSIONS: Readonly<Record<string, string>> = {
  "/dashboard/access": "access.decide",
  "/dashboard/users": "users.view",
  "/dashboard/roles": "permissions.view",
  "/dashboard/replies": "replies.view",
};

export type Viewer = { authorized: boolean; permissions: readonly string[] };

/** Показывать ли раздел этому посетителю в меню и поиске. */
export function isPathVisible(pathname: string, viewer: Viewer): boolean {
  for (const [path, permission] of Object.entries(PATH_PERMISSIONS)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return viewer.permissions.includes(permission);
  }
  if (isProtectedPath(pathname)) return viewer.authorized;
  return true;
}
