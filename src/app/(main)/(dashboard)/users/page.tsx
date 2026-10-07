import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAdminContext } from "@/lib/auth/admin";
import { warmAvatars } from "@/lib/auth/avatar";
import { getAuthConfig } from "@/lib/auth/config";
import { checkDatabase, getGroupPermissions, listUserOverrides, listUsers } from "@/lib/auth/db";

import { UsersManager } from "./_components/users-manager";
import { toUserItem, type UserItem } from "./_lib";

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
  if (!config) redirect("/");

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
  let groupPermissions: Awaited<ReturnType<typeof getGroupPermissions>>;
  try {
    const [list, overrides, permissions] = await Promise.all([listUsers(), listUserOverrides(), getGroupPermissions()]);
    users = list.map((user) => toUserItem(user, overrides.get(user.telegramId)));
    groupPermissions = permissions;
  } catch (error) {
    console.error("[users] Не удалось загрузить список", error);
    return <Notice>База данных недоступна. Список пользователей появится, когда подключение восстановится.</Notice>;
  }

  warmAvatars(users.filter((user) => user.adminGroup).map((user) => user.telegramId));

  return (
    <UsersManager
      users={users}
      me={{
        id: admin.id,
        level: admin.level,
        canDecide: admin.permissions.includes("access.decide"),
        canAssign: admin.permissions.includes("groups.assign"),
        permissions: admin.permissions,
      }}
      groupPermissions={groupPermissions}
      lockedAdminIds={config.adminIds}
    />
  );
}
