import { notFound, redirect } from "next/navigation";

import type { Metadata } from "next";

import { getUserStats, type UserStats } from "@/lib/academy/store";
import { getAdminContext } from "@/lib/auth/admin";
import { LOGIN_PATH } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getUser, groupOfUser } from "@/lib/auth/db";
import { groupLevel } from "@/lib/auth/groups";

import { StaffProfileView } from "../_components/staff-profile-view";

export const metadata: Metadata = {
  title: "Профиль администратора | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">{children}</div>;
}

/** Профиль и статистика другого администратора. Открывается любому администратору, обычным участникам закрыт. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getCurrentUser();
  if (!session) redirect(`${LOGIN_PATH}?next=/dashboard/profile/${encodeURIComponent(id)}`);

  const admin = await getAdminContext();
  if (!admin) redirect("/unauthorized");

  // Свой профиль открывается на обычной странице: там настройки и история входов
  if (id === admin.id) redirect("/dashboard/profile");
  if (!/^\d{1,20}$/.test(id)) notFound();

  let user: Awaited<ReturnType<typeof getUser>>;
  try {
    user = await getUser(id);
  } catch (error) {
    console.error("[profile] Не удалось загрузить профиль администратора", error);
    return <Notice>База данных недоступна. Профиль появится, когда подключение восстановится.</Notice>;
  }

  // Смотреть можно только администрацию: профили обычных участников остаются закрытыми
  const group = user ? groupOfUser(user) : null;
  if (!user || !group || user.status !== "approved") notFound();

  // Если база не ответила, профиль всё равно открывается, только без статистики
  let academy: UserStats | null = null;
  try {
    academy = await getUserStats(user.telegramId);
  } catch (error) {
    console.error("[profile] Не удалось загрузить статистику Академии", error);
  }

  return <StaffProfileView user={user} group={group} academy={academy} canEditIdentity={admin.level > groupLevel(group)} />;
}
