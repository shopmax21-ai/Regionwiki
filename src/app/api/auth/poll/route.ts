import { type NextRequest, NextResponse } from "next/server";

import { hashToken, isAttemptToken } from "@/lib/auth/attempt";
import { ATTEMPT_COOKIE, CODE_MAX_ATTEMPTS, getAuthConfig } from "@/lib/auth/config";
import { getAttempt } from "@/lib/auth/db";

export const dynamic = "force-dynamic";

/** Сайт спрашивает: нажал ли пользователь Start в боте и пришёл ли код. */
export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  if (!config) return NextResponse.json({ state: "none" }, { status: 503 });

  const token = request.cookies.get(ATTEMPT_COOKIE)?.value;
  if (!token || !isAttemptToken(token)) return NextResponse.json({ state: "none" });

  const attempt = await getAttempt(hashToken(token));
  if (!attempt || attempt.consumed || attempt.expired || attempt.attempts >= CODE_MAX_ATTEMPTS) {
    return NextResponse.json({ state: "expired" });
  }

  return NextResponse.json({
    state: attempt.telegramId ? "code_sent" : "waiting",
    link: `https://t.me/${config.botUsername}?start=${token}`,
    attemptsLeft: CODE_MAX_ATTEMPTS - attempt.attempts,
  });
}
