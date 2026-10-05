import { type NextRequest, NextResponse } from "next/server";

import { getAdmin } from "@/lib/auth/admin";
import { IMAGE_MAX_BYTES, ImageStoreError, saveImage } from "@/lib/jobs/images";

export const dynamic = "force-dynamic";

/**
 * Загрузить картинку для гайда, предмета или транспорта. Нужно право «Редактирование работ и гайдов», «Редактирование предметов» или «Редактирование транспорта».
 * Принимает multipart-форму с полем file.
 */
export async function POST(request: NextRequest) {
  const admin = (await getAdmin("jobs.edit")) ?? (await getAdmin("items.edit")) ?? (await getAdmin("transport.edit"));
  if (!admin) return NextResponse.json({ error: "Недостаточно прав для загрузки картинок" }, { status: 403 });

  // Запрос должен прийти с этого же сайта, а не со страницы чужого сайта
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Запрос с другого сайта отклонён" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Ожидается файл" }, { status: 415 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Файл не получен" }, { status: 400 });
  if (file.size > IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Картинка больше 5 МБ, уменьшите её" }, { status: 413 });
  }

  try {
    const url = await saveImage(new Uint8Array(await file.arrayBuffer()), admin.id);
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    if (error instanceof ImageStoreError) {
      if (error.code === "type") {
        return NextResponse.json({ error: "Подходят только PNG, JPEG, WebP и GIF" }, { status: 415 });
      }
      if (error.code === "size")
        return NextResponse.json({ error: "Картинка больше 5 МБ, уменьшите её" }, { status: 413 });
      if (error.code === "empty") return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
    }
    console.error("[jobs] Не удалось сохранить картинку", error);
    return NextResponse.json({ error: "База данных недоступна, попробуйте позже" }, { status: 503 });
  }
}
