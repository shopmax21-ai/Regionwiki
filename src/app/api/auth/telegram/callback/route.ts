import { type NextRequest, NextResponse } from "next/server";

import { createRemoteJWKSet, jwtVerify } from "jose";

import {
  CALLBACK_PATH,
  getAuthConfig,
  isProduction,
  LOGIN_PATH,
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  safeNext,
  TELEGRAM_ISSUER,
  TELEGRAM_JWKS_URL,
  TELEGRAM_TOKEN_URL,
} from "@/lib/auth/config";
import { createSessionToken } from "@/lib/auth/session";

import { timingSafeEqual } from "node:crypto";

const jwks = createRemoteJWKSet(new URL(TELEGRAM_JWKS_URL));

const sameString = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** Возврат из Telegram: обмен code на id_token, проверка подписи и выдача сессии. */
export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  const origin = config?.baseUrl ?? request.nextUrl.origin;

  const fail = (code: "config" | "denied" | "failed" | "forbidden") => {
    const response = NextResponse.redirect(new URL(`${LOGIN_PATH}?error=${code}`, origin));
    response.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
    return response;
  };

  // Без списка разрешённых ID вход открыт всем пользователям Telegram — так не оставляем.
  if (!config || config.allowedIds.length === 0) return fail("config");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return fail(params.get("error") === "access_denied" ? "denied" : "failed");

  const code = params.get("code");
  const state = params.get("state");
  const rawCookie = request.cookies.get(OAUTH_COOKIE)?.value;
  if (!code || !state || !rawCookie) return fail("failed");

  try {
    const saved = JSON.parse(rawCookie) as { state?: string; verifier?: string; next?: string };
    if (!saved.state || !saved.verifier || !sameString(saved.state, state)) return fail("failed");

    const tokenResponse = await fetch(TELEGRAM_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}${CALLBACK_PATH}`,
        client_id: config.clientId,
        code_verifier: saved.verifier,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) return fail("failed");

    const { id_token: idToken } = (await tokenResponse.json()) as { id_token?: string };
    if (!idToken) return fail("failed");

    const { payload } = await jwtVerify(idToken, jwks, { issuer: TELEGRAM_ISSUER, audience: config.clientId });

    const telegramId = String(payload.id ?? "");
    if (!telegramId) return fail("failed");
    if (!config.allowedIds.includes(telegramId)) return fail("forbidden");

    const token = await createSessionToken(
      {
        id: telegramId,
        name: typeof payload.name === "string" ? payload.name : telegramId,
        username: typeof payload.preferred_username === "string" ? payload.preferred_username : undefined,
        picture: typeof payload.picture === "string" ? payload.picture : undefined,
      },
      config.secret,
    );

    const nextPath = safeNext(saved.next);
    const codePath = `/auth/v2/code?next=${encodeURIComponent(nextPath)}`;
    const response = NextResponse.redirect(new URL(codePath, origin));
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    response.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
    return response;
  } catch {
    return fail("failed");
  }
}
