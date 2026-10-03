import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { siTelegram } from "simple-icons";

import { SimpleIcon } from "@/components/simple-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAuthConfig, SESSION_COOKIE, safeNext } from "@/lib/auth/config";
import { readSessionToken } from "@/lib/auth/session";

import { authButtonClass } from "../../_components/auth-styles";
import { RegionLogo } from "../../_components/region-logo";

export const metadata: Metadata = {
  title: "Вход | Region WIKI",
  description: "Вход в Region WIKI через Telegram.",
  robots: { index: false, follow: false },
};

const errors: Record<string, { title: string; text: string }> = {
  forbidden: {
    title: "Нет доступа",
    text: "Этот Telegram-аккаунт не добавлен в список доступа. Обратитесь к куратору проекта.",
  },
  denied: {
    title: "Вход отменён",
    text: "Вы отклонили запрос в Telegram. Попробуйте ещё раз.",
  },
  failed: {
    title: "Не удалось войти",
    text: "Telegram не подтвердил вход. Попробуйте ещё раз.",
  },
  config: {
    title: "Вход не настроен",
    text: "Не заданы ключи Telegram или список разрешённых аккаунтов. Сообщите администратору сайта.",
  },
};

export default async function LoginV2({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const nextPath = safeNext(next);

  const auth = getAuthConfig();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (auth && token && (await readSessionToken(token, auth.secret))) redirect(nextPath);

  const message = error ? (errors[error] ?? errors.failed) : null;
  const href = `/api/auth/telegram/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <RegionLogo />
        <h1 className="font-medium text-foreground/80 text-xs">Панель управления Region WIKI</h1>
      </div>

      {message && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{message.title}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <a href={href} className={authButtonClass}>
        <SimpleIcon icon={siTelegram} className="size-4" />
        Войти через Telegram
      </a>

      <p className="text-center text-muted-foreground text-xs">
        Доступ только для администрации проекта. Мы получаем из Telegram имя, username и фото профиля.
      </p>
    </>
  );
}
