"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getAdminContext } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { isAdminGroup } from "@/lib/auth/groups";

export async function setRolePreview(group: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await getAdminContext();
  if (admin?.group !== "chief" || !(getAuthConfig()?.adminIds.includes(admin.id) ?? false)) {
    return { ok: false, error: "Режим предпросмотра доступен только Главному администратору из .env" };
  }
  if (group !== null && group !== "" && !isAdminGroup(group)) {
    return { ok: false, error: "Выбрана неизвестная роль" };
  }

  const cookieStore = await cookies();
  if (group === null || group === "") {
    cookieStore.delete("role_preview");
  } else {
    cookieStore.set("role_preview", group, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
