"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { getAuthConfig, SESSION_COOKIE } from "@/lib/auth/config";
import { decideUser, getUser } from "@/lib/auth/db";
import { readSessionToken } from "@/lib/auth/session";
import { notifyUserDecision } from "@/lib/auth/telegram";

/** Одобрить или отклонить заявку. Права администратора проверяются по базе, а не по cookie. */
export async function decideAccess(formData: FormData) {
  const config = getAuthConfig();
  if (!config) return;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token, config.secret) : null;
  const admin = session ? await getUser(session.id) : null;
  if (!admin || admin.role !== "admin" || admin.status !== "approved") return;

  const telegramId = String(formData.get("telegramId") ?? "");
  const decision = formData.get("decision");
  if (!telegramId || (decision !== "approved" && decision !== "rejected")) return;

  const user = await decideUser(telegramId, decision, admin.telegramId);
  if (user) await notifyUserDecision(config, user.telegramId, decision === "approved");
  revalidatePath("/dashboard/access");
}
