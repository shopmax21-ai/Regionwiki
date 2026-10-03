import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAuthConfig, LOGIN_PATH, SESSION_COOKIE, safeNext } from "@/lib/auth/config";
import { readSessionToken } from "@/lib/auth/session";

import { RegionLogo } from "../../_components/region-logo";
import TelegramCodeForm from "../../_components/telegram-code-form";

export const metadata: Metadata = {
  title: "Код Telegram | Region WIKI",
  description: "Подтверждение входа в Region WIKI кодом из Telegram.",
  robots: { index: false, follow: false },
};

export default async function TelegramCodePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = safeNext(next);
  const auth = getAuthConfig();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  if (!auth || !token || !(await readSessionToken(token, auth.secret))) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(nextPath)}`);
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <RegionLogo />
        <h1 className="font-medium text-foreground/80 text-xs">Подтверждение входа</h1>
      </div>

      <p className="text-center text-muted-foreground text-sm">Введите код, который вы получили в Telegram.</p>

      <TelegramCodeForm />
    </>
  );
}
