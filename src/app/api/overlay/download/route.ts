import { type NextRequest, NextResponse } from "next/server";

import { resolveOverlayFile } from "@/lib/overlay/files";
import { authenticateOverlayRequest } from "@/lib/overlay/user-auth";

import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

/**
 * Скачивание оверлея: GET /api/overlay/download?file=region-overlay.zip.
 * Доступно администрации: по входу на сайте (кнопка на странице «Оверлей») или по личному ключу программы
 * (Authorization: Bearer rgo_…), которым пользуется автообновление.
 */
export async function GET(request: NextRequest) {
  const admin = await authenticateOverlayRequest(request);
  if (!admin)
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });

  const name = request.nextUrl.searchParams.get("file") ?? "";
  const file = await resolveOverlayFile(name);
  if (!file)
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const stream = createReadStream(file.path);
  stream.on("error", (error) => console.error("[overlay] Ошибка чтения файла для скачивания", error));
  const asciiName = name.replace(/[^\w.\- ]/g, "_");
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
