import { type NextRequest, NextResponse } from "next/server";

import { IMAGE_MAX_BYTES, ImageStoreError, isBodyTooLarge, saveImage } from "@/lib/jobs/images";
import { authenticateOverlayUser } from "@/lib/overlay/user-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

/**
 * Скриншот-доказательство из оверлея: POST /api/overlay/punishments/upload (multipart, поле file).
 * Возвращает { url }, который кладётся в доказательства заявки. Нужен личный токен и право подачи заявок:
 * у оверлея нет сессии сайта, поэтому загрузка картинок для заявок проверяется здесь.
 */
export async function POST(request: NextRequest) {
  const helper = await authenticateOverlayUser(request);
  if (!helper) return fail("Неверный личный токен", 401);
  if (!helper.permissions.includes("punishments.request")) return fail("Недостаточно прав для подачи заявок", 403);

  if (isBodyTooLarge(request)) return fail("Картинка больше 5 МБ, уменьшите её", 413);
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) return fail("Ожидается файл", 415);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Файл не получен", 400);
  if (file.size > IMAGE_MAX_BYTES) return fail("Картинка больше 5 МБ, уменьшите её", 413);

  try {
    const url = await saveImage(new Uint8Array(await file.arrayBuffer()), helper.id);
    return NextResponse.json({ ok: true, url }, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof ImageStoreError) {
      if (error.code === "type") return fail("Подходят только PNG, JPEG, WebP и GIF", 415);
      if (error.code === "convert") return fail("Не удалось обработать картинку: файл повреждён", 415);
      if (error.code === "size") return fail("Картинка больше 5 МБ, уменьшите её", 413);
      if (error.code === "empty") return fail("Файл пустой", 400);
    }
    console.error("[overlay] Не удалось сохранить скриншот", error);
    return fail("База данных недоступна, попробуйте позже", 503);
  }
}
