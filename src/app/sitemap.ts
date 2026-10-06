import type { MetadataRoute } from "next";

import { APP_CONFIG } from "@/config/app-config";

const SITE_URL = APP_CONFIG.siteUrl;

const PUBLIC_ROUTES = [
  "/",
  "/dashboard/default",
  "/dashboard/finance",
  "/dashboard/analytics",
  "/dashboard/productivity",
  "/dashboard/ecommerce",
  "/dashboard/logistics",
  "/dashboard/infrastructure",
  "/dashboard/file-manager",
  "/dashboard/transport",
  "/dashboard/real-estate",
  "/dashboard/business",
  "/dashboard/jobs",
  "/dashboard/profile",
  "/dashboard/users",
  "/dashboard/roles",
  "/auth/v2/login",
  "/mail",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
  }));
}
