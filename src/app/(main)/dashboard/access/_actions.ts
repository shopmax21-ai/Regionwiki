"use server";

import { revalidatePath } from "next/cache";

import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { decideUser } from "@/lib/auth/db";
import { notifyUserDecision } from "@/lib/auth/telegram";

/** Одобрить или отклонить заявку. Право «Одобрение доступа» проверяется по базе, а не по cookie. */
export async function decideAccess(formData: FormData) {
  const config = getAuthConfig();
  if (!config) return;

  const admin = await getAdmin("access.decide");
  if (!admin) return;

  const telegramId = String(formData.get("telegramId") ?? "");
  const decision = formData.get("decision");
  if (!telegramId || (decision !== "approved" && decision !== "rejected")) return;

  const user = await decideUser(telegramId, decision, admin.id);
  if (user) await notifyUserDecision(config, user.telegramId, decision === "approved");
  revalidatePath("/dashboard/access");
}
