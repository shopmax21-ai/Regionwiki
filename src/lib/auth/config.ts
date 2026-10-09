export const SESSION_COOKIE = "region_session";
export const ATTEMPT_COOKIE = "region_login_attempt";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 дней
/** Раз в сколько секунд сессия сверяется с базой (одобрение, блокировка). */
export const SESSION_RECHECK_SECONDS = 5 * 60;

export const LOGIN_PATH = "/auth/v2/login";

export { isProtectedPath, PROTECTED_PATHS } from "./protected-paths";
export const ONBOARDING_PATH = "/auth/v2/onboarding";
export const PENDING_PATH = "/auth/v2/pending";
export const DEFAULT_REDIRECT = "/";

/** Код: 6 цифр, живёт 5 минут, на один код даётся 5 попыток. */
export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 5 * 60;
export const CODE_MAX_ATTEMPTS = 5;
/** Не больше стольких попыток входа в минуту с одного IP. */
export const START_LIMIT_PER_MINUTE = 10;

export const TELEGRAM_API_URL = "https://api.telegram.org";

export const isProduction = process.env.NODE_ENV === "production";

export type AuthConfig = {
  /** Секрет подписи сессии и хэшей кодов (не короче 32 символов) */
  secret: string;
  /** Токен бота из @BotFather */
  botToken: string;
  /** Username бота без @ — нужен для ссылки и QR-кода */
  botUsername: string;
  /** Секрет, который Telegram присылает вместе с каждым запросом вебхука */
  webhookSecret: string;
  /** Telegram ID администраторов: входят без одобрения и подтверждают заявки */
  adminIds: string[];
};

/**
 * Возвращает настройки входа или null, если вход не настроен.
 * Пока переменные окружения не заданы, в разработке защищённые разделы открыты, а в production закрыты (ответ 503).
 */
export function getAuthConfig(): AuthConfig | null {
  const secret = process.env.AUTH_SECRET;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!process.env.DATABASE_URL || !secret || secret.length < 32 || !botToken || !botUsername || !webhookSecret) {
    return null;
  }

  return {
    secret,
    botToken,
    botUsername,
    webhookSecret,
    adminIds: (process.env.TELEGRAM_ADMIN_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  };
}

/** Разрешаем только внутренние пути, чтобы нельзя было увести пользователя на чужой сайт. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return DEFAULT_REDIRECT;
  // Табуляцию и переводы строк браузер вырезает из адреса, поэтому "/<tab>/сайт" превратился бы в "//сайт"
  if ([...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return DEFAULT_REDIRECT;
  if (value.startsWith("/api/") || value.startsWith("/auth/")) return DEFAULT_REDIRECT;
  return value;
}
