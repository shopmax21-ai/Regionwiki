import { type NextRequest, NextResponse } from "next/server";

import { hashToken, newAttemptToken } from "@/lib/auth/attempt";
import {
  ATTEMPT_COOKIE,
  CODE_TTL_SECONDS,
  getAuthConfig,
  isProduction,
  START_LIMIT_PER_MINUTE,
} from "@/lib/auth/config";
import { countRecentAttempts, createAttempt } from "@/lib/auth/db";
import { authErrorResponse } from "@/lib/auth/errors";
import { clientIp } from "@/lib/auth/request";

/** Нажатие «Войти через Telegram»: создаёт попытку и отдаёт ссылку на бота (она же в QR-коде). */
export async function POST(request: NextRequest) {
  const config = getAuthConfig();
  if (!config) return NextResponse.json({ error: "config" }, { status: 503 });

  try {
    const ip = clientIp(request);
    if ((await countRecentAttempts(ip)) >= START_LIMIT_PER_MINUTE) {
      return NextResponse.json({ error: "too_many" }, { status: 429 });
    }

    const token = newAttemptToken();
    await createAttempt(hashToken(token), ip, CODE_TTL_SECONDS);

    const response = NextResponse.json({
      link: `https://t.me/${config.botUsername}?start=${token}`,
      ttl: CODE_TTL_SECONDS,
    });
    response.cookies.set(ATTEMPT_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/api/auth",
      maxAge: CODE_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    return authErrorResponse("start", error);
  }
}
