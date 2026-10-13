import { readdir, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Файлы оверлея лежат в папке overlay-downloads в корне проекта (не в public, поэтому без входа их не скачать).
 * Новую сборку достаточно положить в эту папку: она появится в разделе «Оверлей».
 */
export const OVERLAY_DIR = path.join(process.cwd(), "overlay-downloads");

const ALLOWED = /^[\w.\- ]+\.(zip|exe|msi|7z)$/i;

export type OverlayFile = { name: string; size: number; updatedAt: string };

export async function listOverlayFiles(): Promise<OverlayFile[]> {
  try {
    const names = (await readdir(OVERLAY_DIR)).filter((name) => ALLOWED.test(name));
    const files = await Promise.all(
      names.map(async (name) => {
        const info = await stat(path.join(OVERLAY_DIR, name));
        return info.isFile() ? { name, size: info.size, updatedAt: info.mtime.toISOString() } : null;
      }),
    );
    return files
      .filter((file): file is OverlayFile => file !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/** Полный путь к файлу из списка. Имя проверяется по списку, поэтому выйти за пределы папки нельзя. */
export async function resolveOverlayFile(name: string): Promise<{ path: string; size: number } | null> {
  if (!ALLOWED.test(name) || name !== path.basename(name)) return null;
  const file = (await listOverlayFiles()).find((item) => item.name === name);
  return file ? { path: path.join(OVERLAY_DIR, file.name), size: file.size } : null;
}
