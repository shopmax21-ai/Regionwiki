import { type NextRequest, NextResponse } from "next/server";

import { getAdminContext } from "@/lib/auth/admin";
import { resolveOverlayFile } from "@/lib/overlay/files";

import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

/** Скачивание оверлея: GET /api/overlay/download?file=region-overlay.zip. Только для администрации. */
export async function GET(request: NextRequest) {
  const admin = await getAdminContext();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const name = request.nextUrl.searchParams.get("file") ?? "";
  const file = await resolveOverlayFile(name);
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = Readable.toWeb(createReadStream(file.path)) as ReadableStream;
  return new Response(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
