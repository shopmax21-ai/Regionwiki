import { NextResponse } from "next/server";

import { getMediaFeed } from "@/lib/media/feed";

export const dynamic = "force-dynamic";

/**
 * Живые трансляции проекта на Twitch и YouTube. Открыт всем: данные публичные, а к площадкам сервер обращается
 * не чаще раза в минуту (результат кэшируется), сколько бы посетителей ни обновляло страницу.
 */
export async function GET() {
  const body = await getMediaFeed();
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60" },
  });
}
