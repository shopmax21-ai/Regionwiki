"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { personPlainText } from "@/lib/auth/person";
import { BUG_HOURLY_LIMIT, BugStoreError, createBug, setBugStatus } from "@/lib/bugs/store";
import { isBugStatus } from "@/lib/bugs/types";
import { validateBug } from "@/lib/bugs/validate";

import { createHash } from "node:crypto";

export type ActionResult = { ok: true } | { ok: false; error: string };

function failure(error: unknown): ActionResult {
  if (error instanceof BugStoreError && error.code === "not_found") {
    return { ok: false, error: "Баг-репорт не найден, возможно, его уже удалили" };
  }
  if (error instanceof BugStoreError && error.code === "rate_limit") {
    return { ok: false, error: "Слишком много сообщений за последний час, попробуйте позже" };
  }
  console.error("[bugs] Не удалось сохранить изменения", error);
  return { ok: false, error: "База данных недоступна, попробуйте позже" };
}

/** IP клиента за прокси хостинга: последний адрес из x-forwarded-for дописывает прокси, первые можно подделать. */
async function guestKey(): Promise<string> {
  const list = await headers();
  const ip = list.get("x-forwarded-for")?.split(",").at(-1)?.trim() || list.get("x-real-ip") || "unknown";
  return `guest:${createHash("sha256").update(ip).digest("hex").slice(0, 16)}`;
}

/**
 * Отправить баг-репорт. Вошедший и одобренный участник: до 20 в час. Остальные (гости, не одобренные): до 5 в час
 * с одного IP.
 */
export async function submitBugAction(input: unknown): Promise<ActionResult> {
  const result = validateBug(input);
  if (!result.ok) return result;

  const session = getAuthConfig() ? await getCurrentUser() : null;
  const member = session?.status === "approved";
  const reporter = member ? { id: session.id, name: session.name } : { id: await guestKey(), name: "Гость" };

  try {
    await createBug(result.bug, reporter, member ? BUG_HOURLY_LIMIT.member : BUG_HOURLY_LIMIT.guest);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/bugs");
  return { ok: true };
}

/** Взять в работу, отметить выполненным или вернуть в очередь. Нужно право «Обработка баг-репортов». */
export async function setBugStatusAction(id: string, status: unknown): Promise<ActionResult> {
  const admin = await getAdmin("bugs.manage");
  if (!admin) return { ok: false, error: "Недостаточно прав для обработки баг-репортов" };
  if (typeof id !== "string" || id.length === 0 || id.length > 64)
    return { ok: false, error: "Неизвестный баг-репорт" };
  if (!isBugStatus(status)) return { ok: false, error: "Неизвестный статус" };

  try {
    await setBugStatus(id, status, { id: admin.id, name: personPlainText(admin) });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/bugs");
  return { ok: true };
}
