import { NextResponse } from "next/server";

import { getMediaStreams } from "@/lib/media/twitch";

export const dynamic = "force-dynamic";

/**
 * Живые трансляции проекта на Twitch. Открыт всем: данные публичные, а к Twitch сервер обращается
 * не чаще раза в минуту (результат кэшируется), сколько бы посетителей ни обновляло страницу.
 */
export async function GET() {
  const body = await getMediaStreams();
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60" },
  });
}
