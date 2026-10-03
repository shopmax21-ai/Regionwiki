import { type NextRequest, NextResponse } from "next/server";

import {
  CALLBACK_PATH,
  getAuthConfig,
  isProduction,
  LOGIN_PATH,
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  safeNext,
  TELEGRAM_AUTH_URL,
} from "@/lib/auth/config";

import { createHash, randomBytes } from "node:crypto";

/** Старт входа: Authorization Code Flow + PKCE (S256) через Telegram OIDC. */
export function GET(request: NextRequest) {
  const config = getAuthConfig();
  const origin = config?.baseUrl ?? request.nextUrl.origin;

  if (!config) return NextResponse.redirect(new URL(`${LOGIN_PATH}?error=config`, origin));

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  const url = new URL(TELEGRAM_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", `${origin}${CALLBACK_PATH}`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: OAUTH_COOKIE_PATH,
    maxAge: 60 * 10,
  });
  return response;
}
