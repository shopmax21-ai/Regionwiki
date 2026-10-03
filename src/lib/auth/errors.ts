import { NextResponse } from "next/server";

export type AuthErrorCode = "database_unreachable" | "database_error" | "telegram_unreachable" | "internal";

export type ClassifiedAuthError = {
  code: AuthErrorCode;
  status: number;
  /** Сообщение для пользователя: без хостов, паролей и других внутренностей. */
  message: string;
};

const NETWORK_ERROR_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
]);

const NETWORK_ERROR_PATTERN =
  /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|fetch failed|Error connecting to database/i;

/** Ошибки драйверов вкладывают первопричину в cause / sourceError, поэтому идём по цепочке. */
function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current: unknown = error;
  while (current && chain.length < 6) {
    chain.push(current);
    const next = current as { cause?: unknown; sourceError?: unknown };
    current = next.cause ?? next.sourceError;
  }
  return chain;
}

function isNetworkError(error: unknown): boolean {
  return errorChain(error).some((item) => {
    const { code, message } = item as { code?: unknown; message?: unknown };
    return (
      (typeof code === "string" && NETWORK_ERROR_CODES.has(code)) ||
      (typeof message === "string" && NETWORK_ERROR_PATTERN.test(message))
    );
  });
}

/** Ошибка, о которой мы заранее знаем, к какой зависимости она относится. */
export class AuthDependencyError extends Error {
  readonly dependency: "database" | "telegram";

  constructor(dependency: "database" | "telegram", cause: unknown) {
    super(`${dependency} dependency failed: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = "AuthDependencyError";
    this.dependency = dependency;
  }
}

export function classifyAuthError(error: unknown): ClassifiedAuthError {
  const dependency = error instanceof AuthDependencyError ? error.dependency : null;

  if (dependency === "database") {
    return isNetworkError(error)
      ? {
          code: "database_unreachable",
          status: 503,
          message: "Сервис входа временно недоступен: не удаётся подключиться к базе данных. Попробуйте позже.",
        }
      : {
          code: "database_error",
          status: 500,
          message: "Ошибка базы данных при входе. Мы уже получили информацию об ошибке, попробуйте позже.",
        };
  }

  if (dependency === "telegram") {
    return {
      code: "telegram_unreachable",
      status: 503,
      message: "Не удаётся связаться с Telegram. Попробуйте позже.",
    };
  }

  return {
    code: "internal",
    status: 500,
    message: "Внутренняя ошибка сервера при входе. Мы уже получили информацию об ошибке, попробуйте позже.",
  };
}

/** Полная ошибка (со стеком и первопричиной) пишется только в серверные логи. */
export function logAuthError(scope: string, error: unknown): void {
  const classified = classifyAuthError(error);
  console.error(`[auth] ${scope} failed (${classified.code})`, error);
}

/** Логирует ошибку и отдаёт клиенту понятный ответ вместо «нет связи с сервером». */
export function authErrorResponse(scope: string, error: unknown): NextResponse {
  logAuthError(scope, error);
  const { code, status, message } = classifyAuthError(error);
  return NextResponse.json({ error: code, message }, { status });
}
