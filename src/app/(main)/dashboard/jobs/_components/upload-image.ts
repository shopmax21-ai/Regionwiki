export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(IMAGE_ACCEPT.split(","));

export const isImageFile = (file: File) => TYPES.has(file.type);

/** Загружает картинку на сервер и возвращает её адрес. Бросает Error с понятным текстом. */
export async function uploadImage(file: File): Promise<string> {
  if (!isImageFile(file)) throw new Error("Подходят только PNG, JPEG, WebP и GIF");
  if (file.size > MAX_BYTES) throw new Error("Картинка больше 5 МБ, уменьшите её");

  const body = new FormData();
  body.append("file", file);

  let response: Response;
  try {
    response = await fetch("/api/jobs/images", { method: "POST", body });
  } catch {
    throw new Error("Нет связи с сервером, попробуйте ещё раз");
  }

  const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!response.ok || !data?.url) throw new Error(data?.error ?? "Не удалось загрузить картинку");
  return data.url;
}
