import { createHash } from "node:crypto";

import { getPool } from "@/lib/db/pool";

/**
 * Картинки гайдов лежат в Postgres (таблица wiki_images, байты в bytea): отдельное файловое хранилище не нужно,
 * а на хостингах без постоянного диска файлы не пропадают при перезапуске.
 * Адрес картинки — хеш её содержимого, поэтому одинаковые файлы хранятся один раз, а ответ можно кешировать навсегда.
 */

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export class ImageStoreError extends Error {
  constructor(
    readonly code: "type" | "size" | "empty" | "database",
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}

/** Тип определяется по первым байтам файла, а не по тому, что прислал браузер. SVG не принимаем: в нём может быть скрипт. */
export function sniffImage(bytes: Uint8Array): ImageMime | null {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  // WebP: «RIFF», 4 байта размера, «WEBP»
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

let ready: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  ready ??= getPool()
    .query(`CREATE TABLE IF NOT EXISTS wiki_images (
      id text PRIMARY KEY,
      mime text NOT NULL,
      data bytea NOT NULL,
      size integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      created_by text
    )`)
    .then(() => undefined)
    .catch((error) => {
      ready = null;
      throw error;
    });
  return ready;
}

export const imageUrl = (id: string) => `/api/jobs/images/${id}`;

export const IMAGE_ID_PATTERN = /^[a-f0-9]{64}$/;

/** Сохраняет картинку и возвращает её адрес. */
export async function saveImage(bytes: Uint8Array, createdBy: string): Promise<string> {
  if (bytes.byteLength === 0) throw new ImageStoreError("empty");
  if (bytes.byteLength > IMAGE_MAX_BYTES) throw new ImageStoreError("size");
  const mime = sniffImage(bytes);
  if (!mime) throw new ImageStoreError("type");

  const id = createHash("sha256").update(bytes).digest("hex");
  try {
    await ensureReady();
    await getPool().query(
      "INSERT INTO wiki_images (id, mime, data, size, created_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
      [id, mime, Buffer.from(bytes), bytes.byteLength, createdBy],
    );
  } catch (error) {
    throw new ImageStoreError("database", error);
  }
  return imageUrl(id);
}

export async function loadImage(id: string): Promise<{ mime: string; data: Buffer } | null> {
  if (!IMAGE_ID_PATTERN.test(id)) return null;
  await ensureReady();
  const { rows } = await getPool().query<{ mime: string; data: Buffer }>(
    "SELECT mime, data FROM wiki_images WHERE id = $1",
    [id],
  );
  return rows[0] ?? null;
}
