import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAdminContext } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { listBugs } from "@/lib/bugs/store";
import { type BugStatus, isBugStatus } from "@/lib/bugs/types";

import { BugsBoard } from "./_components/bugs-board";

export const metadata: Metadata = {
  title: "Баг-репорты | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string | string[] }>;

/** Раздел только для администрации с правом «Просмотр баг-репортов». Остальным сообщения недоступны. */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  if (!getAuthConfig()) redirect("/");

  const admin = await getAdminContext();
  if (!admin?.permissions.includes("bugs.view")) redirect("/unauthorized");

  const raw = (await searchParams).status;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const status: BugStatus | undefined = isBugStatus(value) ? value : undefined;

  try {
    const { bugs, counts } = await listBugs(status);
    return (
      <BugsBoard bugs={bugs} counts={counts} current={status} canManage={admin.permissions.includes("bugs.manage")} />
    );
  } catch (error) {
    console.error("[bugs] Не удалось загрузить баг-репорты", error);
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        База данных недоступна. Баг-репорты появятся, когда подключение восстановится.
      </div>
    );
  }
}
