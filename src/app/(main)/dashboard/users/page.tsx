import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAdminContext } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { checkDatabase, listUsers } from "@/lib/auth/db";

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

  const admin = await getAdminContext();
  if (!admin?.permissions.includes("users.view")) {
    // Если проблема в базе, а не в правах, говорим об этом честно
    try {
      await checkDatabase();
    } catch {
      return <Notice>База данных недоступна. Список пользователей появится, когда подключение восстановится.</Notice>;
    }
    redirect("/unauthorized");
  }

  let users: UserItem[];
  try {
    users = (await listUsers()).map((user) => ({
      telegramId: user.telegramId,
      name: user.name,
      username: user.username,
      status: user.status,
      adminGroup: user.adminGroup,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      loginCount: user.loginCount,
    }));
  } catch (error) {
    console.error("[users] Не удалось загрузить список", error);
    return <Notice>База данных недоступна. Список пользователей появится, когда подключение восстановится.</Notice>;
  }

  return (
    <UsersManager
      users={users}
      me={{
        id: admin.id,
        level: admin.level,
        canDecide: admin.permissions.includes("access.decide"),
        canAssign: admin.permissions.includes("groups.assign"),
      }}
      lockedAdminIds={config.adminIds}
    />
  );
}
