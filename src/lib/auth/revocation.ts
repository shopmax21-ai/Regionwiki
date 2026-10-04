import { getSessionsValidAfter } from "./db";

const TTL_MS = 10_000;
const FAILURE_TTL_MS = 30_000;
const MAX_ENTRIES = 1000;

const cache = new Map<string, { at: number; validAfter: number; failed: boolean }>();

/**
 * Отозвана ли сессия кнопкой «Выйти на всех устройствах». Ответ базы держим в памяти 10 секунд,
 * чтобы не ходить в базу на каждый запрос. Если база недоступна, сессию не отзываем: иначе любой сбой
 * разлогинил бы всех. Сбой запоминаем на 30 секунд, чтобы страницы не ждали базу при каждом запросе.
 */
export async function isSessionRevoked(session: { id: string; issuedAt: number }): Promise<boolean> {
  let entry = cache.get(session.id);
  if (!entry || Date.now() - entry.at > (entry.failed ? FAILURE_TTL_MS : TTL_MS)) {
    try {
      entry = { at: Date.now(), validAfter: await getSessionsValidAfter(session.id), failed: false };
    } catch {
      entry = { at: Date.now(), validAfter: 0, failed: true };
    }
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(session.id, entry);
  }
  // Секунды округляем вниз: вход сразу после выхода в ту же секунду не должен считаться отозванным
  return session.issuedAt < Math.floor(entry.validAfter);
}

export function forgetRevocation(userId: string): void {
  cache.delete(userId);
}
