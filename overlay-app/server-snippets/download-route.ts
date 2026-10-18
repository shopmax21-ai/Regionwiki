// Скопируйте в сайт как src/app/api/overlay/download/route.ts
// Отдаёт .exe из папки overlay-downloads. Имя файла сверяется со списком папки, обойти её нельзя.
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

export const dynamic = "force-dynamic";

const DIR = path.join(process.cwd(), "overlay-downloads");
const FILE_RE = /^REGION Overlay-\d+\.\d+\.\d+\.exe$/i;

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("file") || "";
  if (!FILE_RE.test(name)) return NextResponse.json({ ok: false, error: "Неверное имя файла" }, { status: 400 });
  const listed = await fs.readdir(DIR).catch(() => [] as string[]);
  if (!listed.includes(name)) return NextResponse.json({ ok: false, error: "Файл не найден" }, { status: 404 });
  const full = path.join(DIR, name);
  const stat = await fs.stat(full);
  return new NextResponse(Readable.toWeb(createReadStream(full)) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
