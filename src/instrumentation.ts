/**
 * Выполняется один раз при старте сервера. Проверяет, что вход настроен и что база доступна,
 * и пишет понятную причину в логи, если нет. Сервер при этом не падает.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getAuthConfig } = await import("@/lib/auth/config");
  const { checkDatabase, databaseHost } = await import("@/lib/auth/db");
  const { logAuthError } = await import("@/lib/auth/errors");

  if (!getAuthConfig()) {
    const missing = [
      "DATABASE_URL",
      "AUTH_SECRET",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_BOT_USERNAME",
      "TELEGRAM_WEBHOOK_SECRET",
    ].filter((name) => !process.env[name]);
    const weakSecret =
      process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32 ? " AUTH_SECRET короче 32 символов." : "";
    console.warn(
      `[auth] Вход не настроен, защита /dashboard выключена. Не заданы: ${missing.join(", ") || "—"}.${weakSecret}`,
    );
    return;
  }

  try {
    await checkDatabase();
    console.info(`[auth] База данных доступна (${databaseHost()}).`);
  } catch (error) {
    console.error(
      `[auth] База данных недоступна на хосте "${databaseHost()}". Проверьте DATABASE_URL: вход работать не будет, пока подключение не восстановится.`,
    );
    logAuthError("startup database check", error);
  }
}
