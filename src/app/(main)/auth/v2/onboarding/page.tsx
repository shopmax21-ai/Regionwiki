import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAuthConfig, LOGIN_PATH, PENDING_PATH, SESSION_COOKIE } from "@/lib/auth/config";
import { getUser, groupOfUser } from "@/lib/auth/db";
import { identityComplete } from "@/lib/auth/identity";
import { readSessionToken } from "@/lib/auth/session";

import { OnboardingForm } from "../../_components/onboarding-form";
import { RegionLogo } from "../../_components/region-logo";

export const metadata: Metadata = {
  title: "Первая авторизация | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OnboardingV2() {
  const auth = getAuthConfig();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = auth && token ? await readSessionToken(token, auth.secret) : null;
  if (!session) redirect(LOGIN_PATH);

  const user = await getUser(session.id);
  if (!user) redirect(LOGIN_PATH);
  if (identityComplete(user)) redirect(user.status === "approved" ? "/" : PENDING_PATH);

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <RegionLogo className="[@media(max-height:720px)]:text-4xl" />
        <h1 className="font-medium text-foreground/80 text-xs">Первая авторизация в Region WIKI</h1>
        <p className="text-muted-foreground text-sm">
          {user.name}, расскажите о себе. Эти данные указываются один раз, потом их изменит только вышестоящий
          администратор.
        </p>
      </div>
      <OnboardingForm askGroup={groupOfUser(user) === null} />
    </>
  );
}
