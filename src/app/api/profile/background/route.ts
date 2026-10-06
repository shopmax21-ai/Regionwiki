import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getUser, setUserBackground } from "@/lib/auth/db";
import { isSameOrigin } from "@/lib/auth/request";
import { IMAGE_MAX_BYTES, ImageStoreError, saveImage } from "@/lib/jobs/images";

export const dynamic = "force-dynamic";

/** Свой фон может менять любой участник с одобренным доступом, чужой — никто: id берётся только из сессии. */
async function currentMember() {
  const session = await getCurrentUser();
  if (!session) return null;
  const user = await getUser(session.id);
  return user?.status === "approved" ? user : null;
}

/** Запрос должен прийти с этого же сайта, а не со страницы чужого сайта. За прокси сверяем хост, а не полный origin. */
const isForeignOrigin = (request: NextRequest) => !isSameOrigin(request);

const unavailable = (error: unknown) => {
  console.error("[profile] Не удалось сохранить фон профиля", error);
  return NextResponse.json({ error: "База данных недоступна, попробуйте позже" }, { status: 503 });
};

/** Загрузить фон блока профиля. Принимает multipart-форму с полем file. */
export async function POST(request: NextRequest) {
  if (isForeignOrigin(request)) {
    return NextResponse.json({ error: "Запрос с другого сайта отклонён" }, { status: 403 });
  }

  let user: Awaited<ReturnType<typeof currentMember>>;
  try {
    user = await currentMember();
  } catch (error) {
    return unavailable(error);
  }
  if (!user) return NextResponse.json({ error: "Войдите заново" }, { status: 401 });

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
    const url = await saveImage(new Uint8Array(await file.arrayBuffer()), user.telegramId);
    await setUserBackground(user.telegramId, url);
    revalidatePath("/dashboard", "layout");
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    if (error instanceof ImageStoreError) {
      if (error.code === "type") {
        return NextResponse.json({ error: "Подходят только PNG, JPEG, WebP и GIF" }, { status: 415 });
      }
      if (error.code === "size") {
        return NextResponse.json({ error: "Картинка больше 5 МБ, уменьшите её" }, { status: 413 });
      }
      if (error.code === "empty") return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
    }
    return unavailable(error);
  }
}

/** Убрать фон блока профиля. */
export async function DELETE(request: NextRequest) {
  if (isForeignOrigin(request)) {
    return NextResponse.json({ error: "Запрос с другого сайта отклонён" }, { status: 403 });
  }

  try {
    const user = await currentMember();
    if (!user) return NextResponse.json({ error: "Войдите заново" }, { status: 401 });
    await setUserBackground(user.telegramId, null);
    revalidatePath("/dashboard", "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return unavailable(error);
  }
}
