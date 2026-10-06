/**
 * Подготовка картинки к загрузке в браузере. Фото с телефона обычно весят 4–12 МБ, бывают в HEIC или приходят
 * без типа файла, поэтому перед отправкой картинка читается как изображение, уменьшается и сохраняется в JPEG.
 * Тип определяется по содержимому (браузер сам декодирует файл), а не по file.type.
 */

export class ImagePrepareError extends Error {
  constructor(readonly code: "decode" | "encode") {
    super(code);
  }
}

type Options = {
  /** Длинная сторона после уменьшения, px */
  maxSide?: number;
  /** Файл не больше этого размера и с подходящим типом отправляется как есть */
  keepIfUnderBytes?: number;
  /** Итоговый размер не больше этого значения */
  targetBytes?: number;
};

const KEEP_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: File): Promise<Decoded> {
  // Основной путь: createImageBitmap учитывает поворот из EXIF, как и <img>
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Часть браузеров не поддерживает опции или формат: пробуем через <img>
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImagePrepareError("decode");
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

export async function prepareImage(file: File, options: Options = {}): Promise<File> {
  const { maxSide = 1920, keepIfUnderBytes = 1.5 * 1024 * 1024, targetBytes = 3 * 1024 * 1024 } = options;

  const isGif = file.type === "image/gif" || /\.gif$/i.test(file.name);
  // Анимированный GIF не пересжимаем, пока он проходит по размеру
  if (isGif && file.size <= targetBytes) return file;

  const decoded = await decode(file);
  try {
    const { width, height } = decoded;
    if (!width || !height) throw new ImagePrepareError("decode");

    const scale = Math.min(1, maxSide / Math.max(width, height));
    if (scale === 1 && KEEP_TYPES.has(file.type) && file.size <= keepIfUnderBytes) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new ImagePrepareError("encode");

    // JPEG не хранит прозрачность: подкладываем белый фон, иначе прозрачные места станут чёрными
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    let blob: Blob | null = null;
    for (const quality of [0.88, 0.8, 0.7, 0.6, 0.5]) {
      blob = await toBlob(canvas, quality);
      if (blob && blob.size <= targetBytes) break;
    }
    if (!blob || blob.size > targetBytes) throw new ImagePrepareError("encode");

    const name = `${file.name.replace(/\.[^.]*$/, "") || "banner"}.jpg`;
    return new File([blob], name, { type: "image/jpeg" });
  } finally {
    decoded.release();
  }
}
