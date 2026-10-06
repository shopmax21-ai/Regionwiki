import { type NextRequest, NextResponse } from "next/server";

import { hashCode, hashToken, isAttemptToken, sameHash } from "@/lib/auth/attempt";
import {
  ATTEMPT_COOKIE,
  CODE_LENGTH,
  CODE_MAX_ATTEMPTS,
  getAuthConfig,
  isProduction,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  safeNext,
} from "@/lib/auth/config";
import { consumeAttempt, recordLogin, takeAttempt } from "@/lib/auth/db";
import { authErrorResponse } from "@/lib/auth/errors";
import { clientIp } from "@/lib/auth/request";
import { createSessionToken } from "@/lib/auth/session";
import { notifyAdminsAboutRequest } from "@/lib/auth/telegram";

/** Проверка 6 цифр. Первый вход создаёт заявку, дальше вход просто пишется в базу. */
export async function POST(request: NextRequest) {
  const config = getAuthConfig();
  if (!config) return NextResponse.json({ error: "config" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { code?: unknown; next?: unknown } | null;
  const code = String(body?.code ?? "");
  const token = request.cookies.get(ATTEMPT_COOKIE)?.value;

  const expired = () => {
    const response = NextResponse.json({ error: "expired" }, { status: 410 });
    response.cookies.set(ATTEMPT_COOKIE, "", { path: "/api/auth", maxAge: 0 });
    return response;
  };

  if (!token || !isAttemptToken(token)) return expired();
  if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const tokenHash = hashToken(token);
    const attempt = await takeAttempt(tokenHash, CODE_MAX_ATTEMPTS);
    if (!attempt) return expired();

    if (!sameHash(attempt.codeHash, hashCode(code, tokenHash, config.secret))) {
      return NextResponse.json({ error: "invalid" }, { status: 401 });
    }
    if (!(await consumeAttempt(tokenHash))) return expired();

    const { user, created, loginId } = await recordLogin({
      telegramId: attempt.telegramId,
      name: attempt.name ?? attempt.telegramId,
      username: attempt.username,
      isAdmin: config.adminIds.includes(attempt.telegramId),
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent") ?? "",
    });

    if (created && user.status === "pending") await notifyAdminsAboutRequest(config, user);

    const session = await createSessionToken(
      {
        id: user.telegramId,
        name: user.name,
        username: user.username ?? undefined,
        status: user.status,
        role: user.role,
        loginId,
      },
      config.secret,
    );

    const response = NextResponse.json({
      ok: true,
      status: user.status,
      next: safeNext(typeof body?.next === "string" ? body.next : null),
    });
    response.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    response.cookies.set(ATTEMPT_COOKIE, "", { path: "/api/auth", maxAge: 0 });
    return response;
  } catch (error) {
    return authErrorResponse("verify", error);
  }
}
