import { cookies } from "next/headers";

import { getAuthConfig, SESSION_COOKIE } from "./config";
import { readSessionToken, type SessionUser } from "./session";

/** Текущий пользователь из сессии или null, если вход не выполнен (или вход не настроен). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const auth = getAuthConfig();
  if (!auth) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? readSessionToken(token, auth.secret) : null;
}
