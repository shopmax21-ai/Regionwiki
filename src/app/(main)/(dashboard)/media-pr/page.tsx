import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAdminContext } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { getMediaPrInfo, listMediaPrEntries } from "@/lib/mediapr/store";

import { MediaPrSection } from "./_components/media-pr-section";

export const metadata: Metadata = {
  title: "Медиа-PR | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Раздел только для администрации с правом «Раздел «Медиа-PR»». Остальным контакты и заметки недоступны. */
export default async function Page() {
  if (!getAuthConfig()) redirect("/");

  const admin = await getAdminContext();
  if (!admin?.permissions.includes("mediapr.view")) redirect("/unauthorized");

  try {
    const [entries, info] = await Promise.all([listMediaPrEntries(), getMediaPrInfo()]);
    return <MediaPrSection entries={entries} info={info} canEdit={admin.permissions.includes("mediapr.edit")} />;
  } catch (error) {
    console.error("[media-pr] Не удалось загрузить раздел", error);
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        База данных недоступна. Раздел «Медиа-PR» появится, когда подключение восстановится.
      </div>
    );
  }
}
