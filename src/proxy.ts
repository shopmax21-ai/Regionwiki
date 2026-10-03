import { type NextRequest, NextResponse } from "next/server";

import {
  getAuthConfig,
  isProduction,
  LOGIN_PATH,
  PENDING_PATH,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  SESSION_RECHECK_SECONDS,
} from "@/lib/auth/config";
import { getUser } from "@/lib/auth/db";
import { createSessionToken, readSessionToken } from "@/lib/auth/session";

const redirectTo = (request: NextRequest, pathname: string, withNext = false) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (withNext) url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
};

/**
 * Закрывает /dashboard: нужен вход и одобрение администратора.
 * Раз в несколько минут статус сверяется с базой, поэтому блокировка действует почти сразу.
 */
export async function proxy(request: NextRequest) {
  const auth = getAuthConfig();
  if (!auth) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token, auth.secret) : null;
  if (!session) return redirectTo(request, LOGIN_PATH, true);
  if (session.status !== "approved") return redirectTo(request, PENDING_PATH);

  if (Date.now() / 1000 - session.issuedAt < SESSION_RECHECK_SECONDS) return NextResponse.next();

  const user = await getUser(session.id);
  if (!user) return redirectTo(request, LOGIN_PATH, true);

  const refreshed = await createSessionToken(
    { id: user.telegramId, name: user.name, username: user.username ?? undefined, status: user.status, role: user.role },
    auth.secret,
  );
  const response = user.status === "approved" ? NextResponse.next() : redirectTo(request, PENDING_PATH);
  response.cookies.set(SESSION_COOKIE, refreshed, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
