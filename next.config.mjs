/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  compiler: {
    // error/warn/info оставляем: по ним видно причину сбоя входа ([auth] ...) в логах хостинга.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn", "info"] } : false,
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
