export const SESSION_COOKIE = "region_session";
export const OAUTH_COOKIE = "region_tg_oauth";
export const OAUTH_COOKIE_PATH = "/api/auth/telegram";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 дней

export const LOGIN_PATH = "/auth/v2/login";
export const DEFAULT_REDIRECT = "/dashboard";
export const CALLBACK_PATH = "/api/auth/telegram/callback";

export const TELEGRAM_ISSUER = "https://oauth.telegram.org";
export const TELEGRAM_AUTH_URL = `${TELEGRAM_ISSUER}/auth`;
export const TELEGRAM_TOKEN_URL = `${TELEGRAM_ISSUER}/token`;
export const TELEGRAM_JWKS_URL = `${TELEGRAM_ISSUER}/.well-known/jwks.json`;

export const isProduction = process.env.NODE_ENV === "production";

export type AuthConfig = {
  /** Секрет для подписи сессии (не короче 32 символов) */
  secret: string;
  /** Client ID из @BotFather → Login Widget */
  clientId: string;
  clientSecret: string;
  /** Telegram ID пользователей, которым разрешён вход */
  allowedIds: string[];
  /** Публичный адрес сайта (если не задан, берётся из запроса) */
  baseUrl?: string;
};

/**
 * Возвращает настройки входа или null, если вход не настроен.
 * Пока переменные окружения не заданы, защита раздела /dashboard выключена.
 */
export function getAuthConfig(): AuthConfig | null {
  const secret = process.env.AUTH_SECRET;
  const clientId = process.env.TELEGRAM_CLIENT_ID;
  const clientSecret = process.env.TELEGRAM_CLIENT_SECRET;

  if (!secret || secret.length < 32 || !clientId || !clientSecret) return null;

  return {
    secret,
    clientId,
    clientSecret,
    allowedIds: (process.env.TELEGRAM_ALLOWED_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
    baseUrl: process.env.AUTH_URL?.replace(/\/+$/, ""),
  };
}

/** Разрешаем только внутренние пути, чтобы нельзя было увести пользователя на чужой сайт. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_REDIRECT;
  if (value.startsWith("/api/") || value.startsWith("/auth/")) return DEFAULT_REDIRECT;
  return value;
}
