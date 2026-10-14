import { headers } from "next/headers";

/**
 * Адрес сайта, каким его видит браузер. Ключ оверлея хранит этот адрес в себе, поэтому в приложении
 * достаточно вставить один ключ: ссылку на сайт вводить не нужно.
 * OVERLAY_SITE_URL позволяет задать адрес явно, если сайт стоит за прокси с нестандартными заголовками.
 */
export async function getSiteOrigin(): Promise<string> {
  const explicit = process.env.OVERLAY_SITE_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "").split(",")[0].trim();
  if (!host) return "";
  const proto = (requestHeaders.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  return `${proto}://${host}`;
}
