const isProduction = process.env.NODE_ENV === "production";

/**
 * Заголовки для всех страниц. Полный script-src не задаём: Next.js вставляет собственные inline-скрипты,
 * а строгий CSP с nonce потребовал бы динамического рендера всех страниц.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactCompiler: true,
  compiler: {
    // error/warn/info оставляем: по ним видно причину сбоя входа ([auth] ...) в логах хостинга.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn", "info"] } : false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/default",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
