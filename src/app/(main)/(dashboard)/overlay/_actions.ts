"use server";

import { getAdminContext } from "@/lib/auth/admin";
import { getSiteOrigin } from "@/lib/overlay/site-origin";
import { createUserToken, revokeUserToken } from "@/lib/overlay/user-token";

export type TokenResult = { ok: true; token: string } | { ok: false; error: string };

/** Ключ доступа оверлея. Прежний ключ перестаёт работать. */
export async function createOverlayTokenAction(): Promise<TokenResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: "Недостаточно прав" };
  const origin = await getSiteOrigin();
  if (!origin) return { ok: false, error: "Не удалось определить адрес сайта. Задайте OVERLAY_SITE_URL на сервере" };
  try {
    return { ok: true, token: await createUserToken(admin.id, origin) };
  } catch (error) {
    console.error("[overlay] Не удалось создать ключ оверлея", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }
}

export async function revokeOverlayTokenAction(): Promise<{ ok: boolean; error?: string }> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: "Недостаточно прав" };
  try {
    await revokeUserToken(admin.id);
    return { ok: true };
  } catch (error) {
    console.error("[overlay] Не удалось отозвать ключ оверлея", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }
}
