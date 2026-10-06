import { type NextRequest, NextResponse } from "next/server";

import { getAdminContext } from "@/lib/auth/admin";
import { getAuthConfig, SESSION_COOKIE, TELEGRAM_API_URL } from "@/lib/auth/config";
import { getUser, groupOfUser } from "@/lib/auth/db";
import { readSessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 8_000;
const HIT_TTL_MS = 60 * 60 * 1000;
/** Нет фото или Telegram не отдаёт его боту: повторно спрашиваем не чаще, чем раз в 10 минут. */
const MISS_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED = 500;

type TgResponse<T> = { ok: boolean; result?: T; description?: string };
type Cached = { at: number; image: { bytes: ArrayBuffer; type: string } | null; reason?: string };

const cache = new Map<string, Cached>();

/** Вызов Bot API. Токен остаётся только в URL запроса и в логи не попадает. */
async function telegram<T>(token: string, method: string, params: Record<string, string>): Promise<TgResponse<T>> {
  const url = `${TELEGRAM_API_URL}/bot${token}/${method}?${new URLSearchParams(params)}`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body = (await response.json().catch(() => null)) as TgResponse<T> | null;
  if (!body) return { ok: false, description: `HTTP ${response.status}` };
  return body;
}

/** Вторая попытка: фото из карточки чата с пользователем. Иногда доступно, когда getUserProfilePhotos отдаёт пустой список. */
async function chatPhotoFileId(token: string, userId: string): Promise<string | undefined> {
  const chat = await telegram<{ photo?: { small_file_id?: string; big_file_id?: string } }>(token, "getChat", {
    chat_id: userId,
  });
  return chat.result?.photo?.small_file_id ?? chat.result?.photo?.big_file_id;
}

async function findFileId(token: string, userId: string): Promise<{ fileId?: string; reason?: string }> {
  const photos = await telegram<{ photos: { file_id: string }[][] }>(token, "getUserProfilePhotos", {
    user_id: userId,
    limit: "1",
  });
  if (!photos.ok) return { reason: `getUserProfilePhotos: ${photos.description ?? "ошибка"}` };

  const sizes = photos.result?.photos[0];
  // Средний размер (около 320 px) хватает для аватара и весит немного.
  const fileId = sizes?.[Math.min(1, (sizes?.length ?? 1) - 1)]?.file_id;
  if (fileId) return { fileId };

  const fallback = await chatPhotoFileId(token, userId).catch(() => undefined);
  if (fallback) return { fileId: fallback };
  return { reason: "Telegram не отдаёт фото этого пользователя боту (нет фото или скрыто настройками приватности)" };
}

function contentType(path: string, header: string | null): string {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  // Telegram иногда отдаёт application/octet-stream: для <img> нужен настоящий тип.
  return header?.startsWith("image/") ? header : "image/jpeg";
}

async function download(token: string, userId: string): Promise<Cached> {
  const { fileId, reason } = await findFileId(token, userId);
  if (!fileId) return { at: Date.now(), image: null, reason };

  const file = await telegram<{ file_path?: string }>(token, "getFile", { file_id: fileId });
  const path = file.result?.file_path;
  if (!path) return { at: Date.now(), image: null, reason: `getFile: ${file.description ?? "нет file_path"}` };

  const image = await fetch(`${TELEGRAM_API_URL}/file/bot${token}/${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!image.ok) return { at: Date.now(), image: null, reason: `загрузка файла: HTTP ${image.status}` };

  return {
    at: Date.now(),
    image: { bytes: await image.arrayBuffer(), type: contentType(path, image.headers.get("content-type")) },
  };
}

function remember(userId: string, entry: Cached) {
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
  cache.set(userId, entry);
}

/**
 * Аватар из Telegram. Идёт через сервер, чтобы токен бота не попал в браузер.
 * Причина отсутствия аватара видна в заголовке ответа X-Avatar-Reason и в логах сервера ([auth] avatar ...).
 */
export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = config && token ? await readSessionToken(token, config.secret) : null;
  if (!config || !user) return new NextResponse(null, { status: 401 });

  // ?id=... — фото другого администратора для его профиля. Отдаётся только администрации, и только для администраторов:
  // по этому адресу нельзя запросить фото обычного участника.
  let targetId = user.id;
  const requested = request.nextUrl.searchParams.get("id");
  if (requested && requested !== user.id) {
    if (!/^\d{1,20}$/.test(requested)) return new NextResponse(null, { status: 400 });
    try {
      if (!(await getAdminContext())) return new NextResponse(null, { status: 403 });
      const target = await getUser(requested);
      if (!target || !groupOfUser(target)) return new NextResponse(null, { status: 404 });
    } catch {
      return new NextResponse(null, { status: 503 });
    }
    targetId = requested;
  }

  const cached = cache.get(targetId);
  if (cached && Date.now() - cached.at < (cached.image ? HIT_TTL_MS : MISS_TTL_MS)) {
    return respond(cached);
  }

  try {
    const entry = await download(config.botToken, targetId);
    if (!entry.image) console.warn(`[auth] avatar ${targetId}: ${entry.reason}`);
    remember(targetId, entry);
    return respond(entry);
  } catch (error) {
    // Токен бота входит в URL запроса, поэтому в лог идёт только тип ошибки.
    console.error(
      `[auth] avatar ${targetId}: запрос к Telegram не удался (${error instanceof Error ? error.name : "ошибка"})`,
    );
    return new NextResponse(null, { status: 502, headers: { "X-Avatar-Reason": "telegram-unreachable" } });
  }
}

function respond(entry: Cached): NextResponse {
  if (!entry.image) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "X-Avatar-Reason": encodeURIComponent(entry.reason ?? "no-photo"),
        "Cache-Control": "private, max-age=300",
      },
    });
  }
  return new NextResponse(entry.image.bytes, {
    headers: { "Content-Type": entry.image.type, "Cache-Control": "private, max-age=3600" },
  });
}
