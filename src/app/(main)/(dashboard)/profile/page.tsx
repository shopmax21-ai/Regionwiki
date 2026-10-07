import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getUserStats, type UserStats } from "@/lib/academy/store";
import { getAdminContext } from "@/lib/auth/admin";
import { LOGIN_PATH } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLoginEvent, getLoginEvents, getUser } from "@/lib/auth/db";

import { ProfileView } from "./_components/profile-view";

export const metadata: Metadata = {
  title: "Профиль | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getCurrentUser();
  if (!session) redirect(`${LOGIN_PATH}?next=/profile`);

  const user = await getUser(session.id);
  if (!user) redirect(LOGIN_PATH);

  // Переключатель уведомлений нужен только тем, кто может рассматривать заявки
  const admin = await getAdminContext();
  const canReceiveRequests = admin?.permissions.includes("access.decide") ?? false;

  // Статистика тестов Академии есть только у администраторов. Если база не ответила, профиль всё равно открывается.
  let academy: UserStats | null = null;
  if (admin) {
    try {
      academy = await getUserStats(user.telegramId);
    } catch (error) {
      console.error("[profile] Не удалось загрузить статистику Академии", error);
    }
  }

  // Активная сессия определяется по записи входа из токена. У старых токенов её нет, тогда берём последний вход.
  const events = await getLoginEvents(user.telegramId);
  let activeId = session.loginId;
  if (activeId && !events.some((event) => event.id === activeId)) {
    const own = await getLoginEvent(user.telegramId, activeId);
    if (own) events.push(own);
    else activeId = undefined;
  }

  return (
    <ProfileView
      user={user}
      events={events}
      activeLoginId={activeId ?? events[0]?.id ?? null}
      canReceiveRequests={canReceiveRequests}
      academy={academy}
      group={admin?.group ?? null}
    />
  );
}
