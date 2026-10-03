import type { MetadataRoute } from "next";

const SITE_URL = "https://studio-admin.arhamkhnz.com";

const PUBLIC_ROUTES = [
  "/",
  "/dashboard/default",
  "/dashboard/crm",
  "/dashboard/finance",
  "/dashboard/analytics",
  "/dashboard/productivity",
  "/dashboard/ecommerce",
  "/dashboard/academy",
  "/dashboard/logistics",
  "/dashboard/infrastructure",
  "/dashboard/file-manager",
  "/dashboard/transport",
  "/dashboard/real-estate",
  "/dashboard/business",
  "/dashboard/jobs",
  "/dashboard/calendar",
  "/dashboard/kanban",
  "/dashboard/tasks",
  "/dashboard/invoice",
  "/dashboard/profile",
  "/dashboard/users",
  "/dashboard/roles",
  "/auth/v2/login",
  "/auth/v2/code",
  "/chat",
  "/mail",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
  }));
}
