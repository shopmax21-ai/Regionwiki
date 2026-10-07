import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAuthConfig, LOGIN_PATH, SESSION_COOKIE } from "@/lib/auth/config";
import { getUser } from "@/lib/auth/db";
import { readSessionToken } from "@/lib/auth/session";

import { PendingStatus } from "../../_components/pending-status";
import { RegionLogo } from "../../_components/region-logo";

export const metadata: Metadata = {
  title: "Ожидание одобрения | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PendingV2() {
  const auth = getAuthConfig();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = auth && token ? await readSessionToken(token, auth.secret) : null;
  if (!session) redirect(LOGIN_PATH);

  const user = await getUser(session.id);
  if (!user) redirect(LOGIN_PATH);
  if (user.status === "approved") redirect("/");

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <RegionLogo className="[@media(max-height:720px)]:text-4xl" />
        <h1 className="font-medium text-foreground/80 text-xs">Панель управления Region WIKI</h1>
      </div>
      <PendingStatus initial={user.status} name={user.name} />
    </>
  );
}
