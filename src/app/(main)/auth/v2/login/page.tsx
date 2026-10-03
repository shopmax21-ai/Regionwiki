import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAuthConfig, PENDING_PATH, SESSION_COOKIE, safeNext } from "@/lib/auth/config";
import { readSessionToken } from "@/lib/auth/session";

import { LoginForm } from "../../_components/login-form";
import { RegionLogo } from "../../_components/region-logo";

export const metadata: Metadata = {
  title: "Вход | Region WIKI",
  description: "Вход в Region WIKI через Telegram-бота.",
  robots: { index: false, follow: false },
};

export default async function LoginV2({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = safeNext(next);

  const auth = getAuthConfig();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = auth && token ? await readSessionToken(token, auth.secret) : null;
  if (session) redirect(session.status === "approved" ? nextPath : PENDING_PATH);

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <RegionLogo />
        <h1 className="font-medium text-foreground/80 text-xs">Панель управления Region WIKI</h1>
      </div>

      {!auth && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Вход не настроен</AlertTitle>
          <AlertDescription>
            Не заданы база данных, токен бота или секреты входа. Сообщите администратору сайта.
          </AlertDescription>
        </Alert>
      )}

      <LoginForm next={nextPath} disabled={!auth} />

      <p className="text-center text-muted-foreground text-xs">
        Первый вход создаёт заявку: доступ открывается после одобрения администратором.
      </p>
    </>
  );
}
