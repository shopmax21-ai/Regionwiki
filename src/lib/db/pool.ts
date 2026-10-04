import { Pool, type PoolConfig } from "pg";

/**
 * Обычный Postgres (Railway, Neon, Supabase, свой сервер). Нужна одна переменная DATABASE_URL.
 * Таблицы создаются автоматически при первом обращении.
 *
 * SSL: для хостов *.railway.internal и localhost шифрование выключено, для остальных включено
 * (без проверки цепочки сертификатов — у Railway и многих провайдеров он самоподписанный).
 * Принудительно: DATABASE_SSL=disable — выключить, DATABASE_SSL=require — включить.
 */
function poolConfig(): PoolConfig {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");

  const url = new URL(raw);
  // sslmode из строки убираем: драйвер сам трактует require как строгую проверку сертификата.
  url.searchParams.delete("sslmode");

  const mode = (process.env.DATABASE_SSL ?? "").toLowerCase();
  const isPrivate =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".railway.internal");
  const useSsl = mode === "require" || (mode !== "disable" && !isPrivate);

  return {
    connectionString: url.toString(),
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  };
}

// Пул живёт в globalThis, чтобы не плодить соединения при горячей перезагрузке в dev.
const globalForPool = globalThis as unknown as { __regionPool?: Pool };

export function getPool(): Pool {
  if (!globalForPool.__regionPool) {
    const pool = new Pool(poolConfig());
    // Без обработчика обрыв соединения в простое роняет весь процесс.
    pool.on("error", (error) => console.error("[db] Ошибка неактивного соединения с базой", error));
    globalForPool.__regionPool = pool;
  }
  return globalForPool.__regionPool;
}
