import sharp from "sharp";

/**
 * Приведение любой загруженной картинки к WebP. Вызывается на сервере из saveImage — единственного места,
 * через которое проходят все загрузки, поэтому в базу попадает только WebP, как бы файл ни был отправлен.
 */

/** Длинная сторона после уменьшения, px. Больше на сайте не нужно, а файл получается в разы легче. */
export const MAX_SIDE = 2560;

const QUALITY = 82;

/** Защита от «бомб»: маленький файл, который распаковывается в картинку на сотни мегапикселей. */
const MAX_INPUT_PIXELS = 40_000_000;

export class ImageConvertError extends Error {
  constructor(cause?: unknown) {
    super("convert", { cause });
  }
}

/**
 * Конвертирует байты картинки (PNG, JPEG, GIF, WebP) в WebP.
 * Поворот из EXIF применяется, метаданные (включая геометки с телефона) не сохраняются,
 * прозрачность сохраняется, анимированные GIF и WebP остаются анимированными.
 */
export async function convertToWebp(bytes: Uint8Array): Promise<Buffer> {
  try {
    return await sharp(bytes, { animated: true, limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 4 })
      .toBuffer();
  } catch (error) {
    throw new ImageConvertError(error);
  }
}
