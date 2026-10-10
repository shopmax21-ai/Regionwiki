import { cache } from "react";

import { cookies } from "next/headers";

import { getAuthConfig, SESSION_COOKIE } from "./config";
import { getUser } from "./db";
import { isSessionRevoked } from "./revocation";
import { readSessionToken, type SessionUser } from "./session";

/** Один запрос к базе на пользователя за один рендер, даже если getCurrentUser вызывают из layout, страницы и действий. */
const loadUser = cache(async (id: string) => {
  try {
    return { user: await getUser(id), failed: false };
  } catch {
    return { user: null, failed: true };
  }
});

/**
 * Текущий пользователь или null, если вход не выполнен (или вход не настроен).
 * Статус и роль берём из базы, а не из cookie: тогда одобрение, блокировка и смена роли действуют сразу,
 * без повторного входа. Cookie нужна только для того, чтобы понять, кто пришёл. Если база недоступна,
 * остаются данные из cookie, чтобы сбой не выбросил всех из аккаунта.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const auth = getAuthConfig();
  if (!auth) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token, auth.secret) : null;
  if (!session || (await isSessionRevoked(session))) return null;

  const { user, failed } = await loadUser(session.id);
  if (failed) return session;
  if (!user) return null;
  return {
    ...session,
    name: user.name,
    username: user.username ?? undefined,
    status: user.status,
    role: user.role,
  };
}
