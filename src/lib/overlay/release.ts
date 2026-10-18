import { OVERLAY_DIR } from "./files";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/** Portable-сборка, которую ставит автообновление: «REGION Overlay-1.14.0.exe». Установщик (Setup) сюда не попадает. */
const RELEASE_RE = /^REGION Overlay-(\d+)\.(\d+)\.(\d+)\.exe$/i;
const SIGNATURE_RE = /^[A-Za-z0-9+/=]{80,200}$/;

export type OverlayRelease = {
  version: string;
  file: string;
  size: number;
  sha256: string;
  /** Подпись Ed25519 над «версия + sha256» из файла «<сборка>.sig»; null, если её не выпустили */
  signature: string | null;
  notes: string;
};

const hashCache = new Map<string, { mtime: number; sha256: string }>();

function sha256Of(file: string, mtime: number): Promise<string> {
  const hit = hashCache.get(file);
  if (hit && hit.mtime === mtime) return Promise.resolve(hit.sha256);
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => {
        const sha256 = hash.digest("hex");
        hashCache.set(file, { mtime, sha256 });
        resolve(sha256);
      });
  });
}

async function readText(file: string, limit: number): Promise<string> {
  try {
    return (await readFile(file, "utf8")).trim().slice(0, limit);
  } catch {
    return "";
  }
}

/** Самая свежая portable-сборка с контрольной суммой, подписью и заметками. null, если сборок нет. */
export async function getLatestRelease(): Promise<OverlayRelease | null> {
  let names: string[];
  try {
    names = await readdir(OVERLAY_DIR);
  } catch {
    return null;
  }
  const newest = names
    .map((name) => ({ name, match: RELEASE_RE.exec(name) }))
    .filter((item): item is { name: string; match: RegExpExecArray } => item.match !== null)
    .sort((a, b) => {
      for (let i = 1; i <= 3; i += 1) if (a.match[i] !== b.match[i]) return Number(b.match[i]) - Number(a.match[i]);
      return 0;
    })[0];
  if (!newest) return null;

  const full = path.join(OVERLAY_DIR, newest.name);
  const info = await stat(full);
  const signature = await readText(`${full}.sig`, 400);
  return {
    version: `${newest.match[1]}.${newest.match[2]}.${newest.match[3]}`,
    file: newest.name,
    size: info.size,
    sha256: await sha256Of(full, info.mtimeMs),
    signature: SIGNATURE_RE.test(signature) ? signature : null,
    notes: await readText(full.replace(/\.exe$/i, ".txt"), 600),
  };
}
