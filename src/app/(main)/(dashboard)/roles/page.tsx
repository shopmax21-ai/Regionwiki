import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAdminContext } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { checkDatabase, getGroupPermissions, listUsers, toPerson } from "@/lib/auth/db";
import { type AdminGroup, adminGroups } from "@/lib/auth/groups";
import type { Person } from "@/lib/auth/person";

import { RolesManager } from "./_components/roles-manager";

export const metadata: Metadata = {
  title: "Роли и права | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">{children}</div>;
}

export default async function Page() {
  if (!getAuthConfig()) redirect("/");

  const admin = await getAdminContext();
  if (!admin?.permissions.includes("permissions.view")) {
    try {
      await checkDatabase();
    } catch {
      return <Notice>База данных недоступна. Права появятся, когда подключение восстановится.</Notice>;
    }
    redirect("/unauthorized");
  }

  try {
    const [permissions, users] = await Promise.all([getGroupPermissions(), listUsers()]);

    const members = Object.fromEntries(adminGroups.map((group) => [group, []])) as unknown as Record<
      AdminGroup,
      Person[]
    >;
    for (const user of users) {
      if (user.adminGroup) members[user.adminGroup].push({ ...toPerson(user), group: user.adminGroup });
    }

    return (
      <RolesManager
        permissions={permissions}
        members={members}
        canEdit={admin.permissions.includes("permissions.edit")}
        myGroup={admin.group}
      />
    );
  } catch (error) {
    console.error("[roles] Не удалось загрузить права", error);
    return <Notice>База данных недоступна. Права появятся, когда подключение восстановится.</Notice>;
  }
}
