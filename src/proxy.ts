import { type NextRequest, NextResponse } from "next/server";

import { getAuthConfig, LOGIN_PATH, SESSION_COOKIE } from "@/lib/auth/config";
import { readSessionToken } from "@/lib/auth/session";

/** Закрывает /dashboard для неавторизованных. Работает, только когда настроен вход через Telegram. */
export async function proxy(request: NextRequest) {
  const auth = getAuthConfig();
  if (!auth) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await readSessionToken(token, auth.secret))) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = "";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
