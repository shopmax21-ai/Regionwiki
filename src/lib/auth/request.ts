import type { NextRequest } from "next/server";

/** IP клиента за прокси Vercel. */
export const clientIp = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
