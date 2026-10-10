import { type NextRequest, NextResponse } from "next/server";

import { accessKey } from "@/lib/auth/access-key";
import { getViewerAccess } from "@/lib/auth/admin";
import { getAuthConfig, isProduction, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getUser, groupOfUser } from "@/lib/auth/db";
import { createSessionToken, readSessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Актуальный доступ текущего посетителя (статус, роль, группа, права). Страница опрашивает этот адрес
 * и перерисовывается, когда ответ изменился. Заодно обновляем cookie, чтобы вход и защита разделов
 * тоже видели новый статус и роль без повторного входа.
 */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const config = getAuthConfig();
  if (!config) return NextResponse.json({ key: null }, { status: 200, headers });

  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ key: null }, { status: 401, headers });

  try {
    const [user, { isAdmin, permissions }] = await Promise.all([getUser(session.id), getViewerAccess()]);
    if (!user) return NextResponse.json({ key: null }, { status: 401, headers });

    const group = groupOfUser(user);
    const response = NextResponse.json(
      { key: accessKey({ status: user.status, role: user.role, group, permissions }), isAdmin },
      { headers },
    );

    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const stored = token ? await readSessionToken(token, config.secret) : null;
    if (stored && (stored.status !== user.status || stored.role !== user.role)) {
      response.cookies.set(
        SESSION_COOKIE,
        await createSessionToken(
          {
            id: user.telegramId,
            name: user.name,
            username: user.username ?? undefined,
            status: user.status,
            role: user.role,
            loginId: stored.loginId,
          },
          config.secret,
        ),
        { httpOnly: true, sameSite: "lax", secure: isProduction, path: "/", maxAge: SESSION_MAX_AGE },
      );
    }
    return response;
  } catch {
    // База недоступна: ничего не меняем, следующий опрос попробует снова
    return NextResponse.json({ key: undefined }, { status: 503, headers });
  }
}
