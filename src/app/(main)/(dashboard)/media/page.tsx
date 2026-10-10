import type { Metadata } from "next";

import { MediaSection } from "@/app/(main)/(dashboard)/media/_components/media-section";
import { getAdminContext } from "@/lib/auth/admin";
import { getUser } from "@/lib/auth/db";

export const metadata: Metadata = {
  title: "Медиа | Region WIKI",
  description: "Трансляции игроков REGION на Twitch: кто в эфире прямо сейчас, сколько зрителей и ссылка на стрим.",
  alternates: { canonical: "/media" },
};

// Подсказка про настройку Twitch нужна только администрации, поэтому страница строится на каждый запрос.
export const dynamic = "force-dynamic";

export default async function Page() {
  const admin = await getAdminContext();
  const canManage = admin?.permissions.includes("media.manage") ?? false;
  // Личная настройка оповещений: если база не ответила, показываем «выключено», раздел остаётся рабочим
  const notifyEnabled = admin
    ? await getUser(admin.id)
        .then((user) => user?.notifyMedia ?? false)
        .catch(() => false)
    : false;
  return <MediaSection isAdmin={admin !== null} canManage={canManage} notifyEnabled={notifyEnabled} />;
}
