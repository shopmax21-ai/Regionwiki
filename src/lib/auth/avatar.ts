import { getAuthConfig, TELEGRAM_API_URL } from "./config";

const REQUEST_TIMEOUT_MS = 8_000;
/** Фото в кэше живёт сутки: аватары в Telegram меняются редко. */
const HIT_TTL_MS = 24 * 60 * 60 * 1000;
/** Нет фото или Telegram не отдаёт его боту: повторно спрашиваем не чаще, чем раз в 10 минут. */
const MISS_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED = 500;

type TgResponse<T> = { ok: boolean; result?: T; description?: string };
export type AvatarImage = { bytes: ArrayBuffer; type: string; etag: string };
export type AvatarEntry = { at: number; image: AvatarImage | null; reason?: string };

/** Кэш лежит в globalThis: страницы (прогрев) и маршрут /api/auth/avatar могут быть разными бандлами. */
const store = globalThis as typeof globalThis & {
  __avatarCache?: Map<string, AvatarEntry>;
  __avatarInflight?: Map<string, Promise<AvatarEntry>>;
};
store.__avatarCache ??= new Map();
store.__avatarInflight ??= new Map();
const cache = store.__avatarCache;
const inflight = store.__avatarInflight;

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

async function download(token: string, userId: string): Promise<AvatarEntry> {
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

  // file_id меняется вместе с фото, поэтому подходит как ETag: браузер получит 304 вместо повторной загрузки
  return {
    at: Date.now(),
    image: {
      bytes: await image.arrayBuffer(),
      type: contentType(path, image.headers.get("content-type")),
      etag: `"${fileId.slice(-24)}"`,
    },
  };
}

function remember(userId: string, entry: AvatarEntry) {
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
  cache.set(userId, entry);
}

const isFresh = (entry: AvatarEntry) => Date.now() - entry.at < (entry.image ? HIT_TTL_MS : MISS_TTL_MS);

/**
 * Аватар из кэша или из Telegram. Одновременные запросы одного человека делят одно обращение к Telegram.
 * Если Telegram не ответил, а в кэше есть старое фото, отдаём его вместо ошибки.
 * Бросает исключение, только когда нечего показать.
 */
export async function getAvatar(botToken: string, userId: string): Promise<AvatarEntry> {
  const cached = cache.get(userId);
  if (cached && isFresh(cached)) return cached;

  let pending = inflight.get(userId);
  if (!pending) {
    pending = download(botToken, userId)
      .then((entry) => {
        if (!entry.image) console.warn(`[auth] avatar ${userId}: ${entry.reason}`);
        // Фото уже есть, а новый запрос ничего не вернул (сбой Telegram): не затираем рабочее фото
        if (!entry.image && cached?.image) return { ...cached, at: Date.now() };
        remember(userId, entry);
        return entry;
      })
      .catch((error) => {
        // Токен бота входит в URL запроса, поэтому в лог идёт только тип ошибки.
        console.error(
          `[auth] avatar ${userId}: запрос к Telegram не удался (${error instanceof Error ? error.name : "ошибка"})`,
        );
        if (cached?.image) return cached;
        throw error;
      })
      .finally(() => inflight.delete(userId));
    inflight.set(userId, pending);
  }
  return pending;
}

/**
 * Заранее подгружает фото в кэш сервера. Вызывается при показе списка людей, чтобы к моменту,
 * когда браузер запросит картинки, они уже лежали в памяти. Не ждёт результата и не падает.
 */
export function warmAvatars(userIds: readonly string[]): void {
  const config = getAuthConfig();
  if (!config) return;
  for (const id of new Set(userIds)) {
    if (!/^\d{1,20}$/.test(id)) continue;
    const cached = cache.get(id);
    if (cached && isFresh(cached)) continue;
    void getAvatar(config.botToken, id).catch(() => undefined);
  }
}
