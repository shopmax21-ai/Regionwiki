import type { MetadataRoute } from "next";

import { APP_CONFIG } from "@/config/app-config";

const SITE_URL = APP_CONFIG.siteUrl;

/** Открытые страницы без входа. Закрытые разделы (PROTECTED_PATHS) и редиректы сюда не попадают. */
const PUBLIC_ROUTES = [
  "/",
  "/transport",
  "/items",
  "/real-estate",
  "/business",
  "/jobs",
  "/map",
  "/media",
  "/rules/general",
  "/rules/government",
  "/rules/changelog",
  "/rp-terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
  }));
}
