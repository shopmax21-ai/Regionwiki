import { type NextRequest, NextResponse } from "next/server";

import { getAuthConfig, isProduction, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/config";
import { getUser } from "@/lib/auth/db";
import { authErrorResponse } from "@/lib/auth/errors";
import { createSessionToken, readSessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Страница ожидания опрашивает статус заявки. Когда админ решил вопрос, сессия обновляется сама. */
export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  if (!config) return NextResponse.json({ status: "none" }, { status: 503 });

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token, config.secret) : null;
  if (!session) return NextResponse.json({ status: "none" }, { status: 401 });

  try {
    const user = await getUser(session.id);
    if (!user) return NextResponse.json({ status: "none" }, { status: 401 });

    const response = NextResponse.json({ status: user.status });
    if (user.status !== session.status || user.role !== session.role) {
      response.cookies.set(
        SESSION_COOKIE,
        await createSessionToken(
          {
            id: user.telegramId,
            name: user.name,
            username: user.username ?? undefined,
            status: user.status,
            role: user.role,
          },
          config.secret,
        ),
        { httpOnly: true, sameSite: "lax", secure: isProduction, path: "/", maxAge: SESSION_MAX_AGE },
      );
    }
    return response;
  } catch (error) {
    return authErrorResponse("status", error);
  }
}
