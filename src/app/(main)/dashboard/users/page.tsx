import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAuthConfig } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getUser, listUsers } from "@/lib/auth/db";

import { type UserItem, UsersManager } from "./_components/users-manager";

export const metadata: Metadata = {
  title: "Пользователи | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">{children}</div>;
}

export default async function Page() {
  const config = getAuthConfig();
  if (!config) redirect("/dashboard");

  const session = await getCurrentUser();
  if (!session) redirect("/auth/v2/login");

  let users: UserItem[];
  try {
    const admin = await getUser(session.id);
    if (!admin || admin.role !== "admin" || admin.status !== "approved") redirect("/unauthorized");

    users = (await listUsers()).map((user) => ({
      telegramId: user.telegramId,
      name: user.name,
      username: user.username,
      status: user.status,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      loginCount: user.loginCount,
    }));
  } catch (error) {
    // redirect() работает через исключение, его пропускаем дальше
    if (error instanceof Error && "digest" in error) throw error;
    console.error("[users] Не удалось загрузить список", error);
    return <Notice>База данных недоступна. Список пользователей появится, когда подключение восстановится.</Notice>;
  }

  return <UsersManager users={users} currentId={session.id} lockedAdminIds={config.adminIds} />;
}
