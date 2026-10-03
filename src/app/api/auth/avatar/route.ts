import { type NextRequest, NextResponse } from "next/server";

import { getAuthConfig, SESSION_COOKIE, TELEGRAM_API_URL } from "@/lib/auth/config";
import { readSessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type TgResponse<T> = { ok: boolean; result?: T };

/** Аватар из Telegram. Идёт через сервер, чтобы токен бота не попал в браузер. */
export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = config && token ? await readSessionToken(token, config.secret) : null;
  if (!config || !user) return new NextResponse(null, { status: 401 });

  const api = `${TELEGRAM_API_URL}/bot${config.botToken}`;
  try {
    const photos = (await (await fetch(`${api}/getUserProfilePhotos?user_id=${user.id}&limit=1`)).json()) as TgResponse<{
      photos: { file_id: string }[][];
    }>;
    const sizes = photos.result?.photos[0];
    // Средний размер (около 160 px) хватает для аватара и весит немного.
    const fileId = sizes?.[Math.min(1, (sizes?.length ?? 1) - 1)]?.file_id;
    if (!fileId) return new NextResponse(null, { status: 404 });

    const file = (await (await fetch(`${api}/getFile?file_id=${fileId}`)).json()) as TgResponse<{ file_path?: string }>;
    const path = file.result?.file_path;
    if (!path) return new NextResponse(null, { status: 404 });

    const image = await fetch(`${TELEGRAM_API_URL}/file/bot${config.botToken}/${path}`);
    if (!image.ok || !image.body) return new NextResponse(null, { status: 404 });

    return new NextResponse(image.body, {
      headers: {
        "Content-Type": image.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
