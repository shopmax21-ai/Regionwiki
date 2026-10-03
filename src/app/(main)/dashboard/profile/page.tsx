import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { LOGIN_PATH } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLoginEvents, getUser } from "@/lib/auth/db";

import { ProfileView } from "./_components/profile-view";

export const metadata: Metadata = {
  title: "Профиль | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getCurrentUser();
  if (!session) redirect(`${LOGIN_PATH}?next=/dashboard/profile`);

  const user = await getUser(session.id);
  if (!user) redirect(LOGIN_PATH);

  return <ProfileView user={user} events={await getLoginEvents(user.telegramId)} />;
}
