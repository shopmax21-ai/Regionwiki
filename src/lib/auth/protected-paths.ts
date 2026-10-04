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
];

export const isProtectedPath = (pathname: string) =>
  PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/** Разделы только для администраторов: остальным не показываются в меню и поиске (сама страница тоже проверяет роль). */
export const ADMIN_ONLY_PATHS: readonly string[] = ["/dashboard/access", "/dashboard/users"];

const matches = (paths: readonly string[], pathname: string) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export type Viewer = { authorized: boolean; admin: boolean };

/** Показывать ли раздел этому посетителю в меню и поиске. */
export function isPathVisible(pathname: string, viewer: Viewer): boolean {
  if (matches(ADMIN_ONLY_PATHS, pathname)) return viewer.admin;
  if (isProtectedPath(pathname)) return viewer.authorized;
  return true;
}
