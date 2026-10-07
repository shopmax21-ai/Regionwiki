import { type NextRequest, NextResponse } from "next/server";

import {
  getAuthConfig,
  isProduction,
  isProtectedPath,
  LOGIN_PATH,
  PENDING_PATH,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  SESSION_RECHECK_SECONDS,
} from "@/lib/auth/config";
import { getUser } from "@/lib/auth/db";
import { isSessionRevoked } from "@/lib/auth/revocation";
import { createSessionToken, readSessionToken } from "@/lib/auth/session";

const redirectTo = (request: NextRequest, pathname: string, withNext = false) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (withNext) url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
};

/**
 * Закрывает только разделы из PROTECTED_PATHS (нужен вход и одобрение администратора), остальное открыто.
 * Раз в несколько минут статус сверяется с базой, поэтому блокировка действует почти сразу.
 */
export async function proxy(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) return NextResponse.next();

  const auth = getAuthConfig();
  if (!auth) {
    // Без настроенного входа в production закрытые разделы не открываем: иначе ошибка в переменных окружения отдала бы их всем.
    if (isProduction) return new NextResponse("Вход не настроен", { status: 503 });
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token, auth.secret) : null;
  if (!session) return redirectTo(request, LOGIN_PATH, true);
  if (await isSessionRevoked(session)) {
    const response = redirectTo(request, LOGIN_PATH, true);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  if (session.status !== "approved") return redirectTo(request, PENDING_PATH);

  if (Date.now() / 1000 - session.issuedAt < SESSION_RECHECK_SECONDS) return NextResponse.next();

  const user = await getUser(session.id);
  if (!user) return redirectTo(request, LOGIN_PATH, true);

  const refreshed = await createSessionToken(
    {
      id: user.telegramId,
      name: user.name,
      username: user.username ?? undefined,
      status: user.status,
      role: user.role,
      loginId: session.loginId,
    },
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
  // Разделы лежат в корне сайта, поэтому прокси смотрит все адреса, кроме API и служебных файлов Next.js.
  // Нужен ли вход для конкретной страницы, решает isProtectedPath.
  matcher: ["/((?!api/|_next/).*)"],
};
