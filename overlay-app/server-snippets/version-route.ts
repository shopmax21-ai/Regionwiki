// Скопируйте в сайт как src/app/api/overlay/version/route.ts
// Отдаёт оверлею сведения о самой свежей portable-версии из папки overlay-downloads.
// Файл должен называться «REGION Overlay-1.8.0.exe» (так его называет build.bat).
import { NextResponse } from "next/server";
import { createReadStream, promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

export const dynamic = "force-dynamic";

const DIR = path.join(process.cwd(), "overlay-downloads");
const FILE_RE = /^REGION Overlay-(\d+)\.(\d+)\.(\d+)\.exe$/i;
const cache = new Map<string, { mtime: number; sha256: string }>();

function sha256(file: string, mtime: number): Promise<string> {
  const hit = cache.get(file);
  if (hit && hit.mtime === mtime) return Promise.resolve(hit.sha256);
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("error", reject).on("end", () => {
      const value = hash.digest("hex");
      cache.set(file, { mtime, sha256: value });
      resolve(value);
    });
  });
}

export async function GET() {
  let names: string[] = [];
  try {
    names = await fs.readdir(DIR);
  } catch {
    return NextResponse.json({ ok: false, error: "Папка overlay-downloads не найдена" }, { status: 404 });
  }
  const files = names
    .map((name) => ({ name, m: FILE_RE.exec(name) }))
    .filter((x): x is { name: string; m: RegExpExecArray } => Boolean(x.m))
    .sort((a, b) => {
      for (let i = 1; i <= 3; i += 1) if (a.m[i] !== b.m[i]) return Number(b.m[i]) - Number(a.m[i]);
      return 0;
    });
  const newest = files[0];
  if (!newest) return NextResponse.json({ ok: false, error: "Нет файлов обновления" }, { status: 404 });

  const full = path.join(DIR, newest.name);
  const stat = await fs.stat(full);
  let notes = "";
  try {
    // Необязательно: рядом можно положить «REGION Overlay-1.8.0.txt» с описанием изменений
    notes = (await fs.readFile(full.replace(/\.exe$/i, ".txt"), "utf8")).slice(0, 600);
  } catch {}
  return NextResponse.json({
    ok: true,
    version: `${newest.m[1]}.${newest.m[2]}.${newest.m[3]}`,
    file: newest.name,
    size: stat.size,
    sha256: await sha256(full, stat.mtimeMs),
    url: `/api/overlay/download?file=${encodeURIComponent(newest.name)}`,
    notes,
  });
}
