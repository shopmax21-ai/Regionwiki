import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getUser, setUserBackground } from "@/lib/auth/db";
import { isSameOrigin } from "@/lib/auth/request";
import { IMAGE_MAX_BYTES, ImageStoreError, isBodyTooLarge, saveImage } from "@/lib/jobs/images";

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

const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const UPLOAD_LIMIT = 10;
const uploads = new Map<string, number[]>();

/** Не больше 10 загрузок за 10 минут на человека: картинки хранятся в базе, и без лимита её можно забить. */
function uploadLimitReached(userId: string): boolean {
  const now = Date.now();
  const recent = (uploads.get(userId) ?? []).filter((time) => now - time < UPLOAD_WINDOW_MS);
  if (recent.length >= UPLOAD_LIMIT) {
    uploads.set(userId, recent);
    return true;
  }
  recent.push(now);
  uploads.set(userId, recent);
  if (uploads.size > 1000) uploads.delete(uploads.keys().next().value as string);
  return false;
}

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

  if (uploadLimitReached(user.telegramId)) {
    return NextResponse.json({ error: "Слишком много загрузок, попробуйте позже" }, { status: 429 });
  }

  if (isBodyTooLarge(request))
    return NextResponse.json({ error: "Картинка больше 5 МБ, уменьшите её" }, { status: 413 });

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
    revalidatePath("/", "layout");
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    if (error instanceof ImageStoreError) {
      if (error.code === "type") {
        return NextResponse.json({ error: "Подходят только PNG, JPEG, WebP и GIF" }, { status: 415 });
      }
      if (error.code === "convert") {
        return NextResponse.json(
          { error: "Не удалось обработать картинку: файл повреждён или слишком большой по размеру изображения" },
          { status: 415 },
        );
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
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return unavailable(error);
  }
}
