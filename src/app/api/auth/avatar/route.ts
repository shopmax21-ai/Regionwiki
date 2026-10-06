import { type NextRequest, NextResponse } from "next/server";

import { getAdminContext } from "@/lib/auth/admin";
import { type AvatarEntry, getAvatar } from "@/lib/auth/avatar";
import { getAuthConfig, SESSION_COOKIE } from "@/lib/auth/config";
import { getUser, groupOfUser } from "@/lib/auth/db";
import { readSessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Проверка «это администратор» запоминается на минуту: страница со списком запрашивает десятки аватаров сразу. */
const ADMIN_TTL_MS = 60 * 1000;
const adminChecks = ((globalThis as { __avatarAdminChecks?: Map<string, number> }).__avatarAdminChecks ??= new Map());

async function isAdminTarget(id: string): Promise<boolean> {
  const checkedAt = adminChecks.get(id);
  if (checkedAt && Date.now() - checkedAt < ADMIN_TTL_MS) return true;
  const target = await getUser(id);
  if (!target || !groupOfUser(target)) return false;
  adminChecks.set(id, Date.now());
  return true;
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

  // ?id=... — фото другого администратора. Отдаётся только администрации, и только для администраторов:
  // по этому адресу нельзя запросить фото обычного участника.
  let targetId = user.id;
  const requested = request.nextUrl.searchParams.get("id");
  if (requested && requested !== user.id) {
    if (!/^\d{1,20}$/.test(requested)) return new NextResponse(null, { status: 400 });
    try {
      if (!(await getAdminContext())) return new NextResponse(null, { status: 403 });
      if (!(await isAdminTarget(requested))) return new NextResponse(null, { status: 404 });
    } catch {
      return new NextResponse(null, { status: 503 });
    }
    targetId = requested;
  }

  try {
    const entry = await getAvatar(config.botToken, targetId);
    if (entry.image && request.headers.get("if-none-match") === entry.image.etag) {
      return new NextResponse(null, { status: 304, headers: imageHeaders(entry.image.etag) });
    }
    return respond(entry);
  } catch {
    return new NextResponse(null, { status: 502, headers: { "X-Avatar-Reason": "telegram-unreachable" } });
  }
}

/** Сутки без запроса к серверу, ещё неделю браузер может показать старое фото и обновить его в фоне. */
const imageHeaders = (etag: string) => ({
  ETag: etag,
  "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
});

function respond(entry: AvatarEntry): NextResponse {
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
    headers: { "Content-Type": entry.image.type, ...imageHeaders(entry.image.etag) },
  });
}
