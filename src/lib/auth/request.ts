import type { NextRequest } from "next/server";

/** IP клиента за прокси Vercel. */
export const clientIp = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

/**
 * Пришёл ли запрос со страницы этого же сайта (защита от отправки формы с чужого сайта).
 * Сравнивать Origin с request.nextUrl.origin нельзя: за прокси хостинга Next видит внутренний адрес
 * (например, http://0.0.0.0:3000), а браузер присылает публичный. Поэтому сверяем хост из Origin
 * с хостом, который передал прокси (x-forwarded-host или host).
 * Запросы без Origin (curl, серверные вызовы) пропускаются: права всё равно проверяются по сессии.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }

  const hosts = [
    request.headers.get("x-forwarded-host")?.split(",")[0],
    request.headers.get("host"),
    request.nextUrl.host,
  ]
    .map((host) => host?.trim().toLowerCase())
    .filter(Boolean);

  return hosts.includes(originHost);
}
