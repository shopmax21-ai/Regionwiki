import type { MetadataRoute } from "next";

import { APP_CONFIG } from "@/config/app-config";

const SITE_URL = APP_CONFIG.siteUrl;

/** Открытые страницы без входа. Закрытые разделы (PROTECTED_PATHS) и редиректы сюда не попадают. */
const PUBLIC_ROUTES = [
  "/dashboard/default",
  "/dashboard/transport",
  "/dashboard/items",
  "/dashboard/real-estate",
  "/dashboard/business",
  "/dashboard/jobs",
  "/dashboard/map",
  "/dashboard/rules/general",
  "/dashboard/rules/government",
  "/dashboard/rules/changelog",
  "/dashboard/rp-terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
  }));
}
