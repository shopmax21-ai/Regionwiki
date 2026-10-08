const isProduction = process.env.NODE_ENV === "production";

/**
 * Заголовки для всех страниц. Полный script-src не задаём: Next.js вставляет собственные inline-скрипты,
 * а строгий CSP с nonce потребовал бы динамического рендера всех страниц.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactCompiler: true,
  // sharp (конвертация загрузок в WebP, lib/images/webp.ts) содержит нативный код: его нельзя включать в сборку,
  // он подключается на сервере как обычный пакет.
  serverExternalPackages: ["sharp"],
  images: {
    // Если картинка идёт через оптимизатор next/image, отдаётся WebP. Загруженные картинки уже лежат в WebP.
    formats: ["image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
  compiler: {
    // error/warn/info оставляем: по ним видно причину сбоя входа ([auth] ...) в логах хостинга.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn", "info"] } : false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // Раньше разделы жили под /dashboard: старые ссылки и закладки ведут на новые адреса.
      { source: "/dashboard", destination: "/", permanent: true },
      { source: "/dashboard/default", destination: "/", permanent: true },
      { source: "/dashboard/:path*", destination: "/:path*", permanent: true },
      { source: "/default", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
