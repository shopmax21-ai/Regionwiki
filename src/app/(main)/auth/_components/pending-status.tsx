"use client";

import { useEffect, useState } from "react";

import { Check, Clock, LogOut, ShieldX } from "lucide-react";
import { cn } from "cn";

import { authButtonClass } from "./auth-styles";

type Status = "pending" | "approved" | "rejected";

const steps = [
  { title: "Вход подтверждён", text: "Telegram-аккаунт подтверждён кодом." },
  { title: "Заявка у администратора", text: "Мы уже отправили её в Telegram администраторам." },
  { title: "Доступ открыт", text: "Страница обновится сама, как только заявку одобрят." },
];

export function PendingStatus({ initial, name }: { initial: Status; name: string }) {
  const [status, setStatus] = useState<Status>(initial);

  useEffect(() => {
    if (status !== "pending") return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (res.status === 401) return window.location.assign("/auth/v2/login");
        const data = (await res.json()) as { status: Status };
        setStatus(data.status);
      } catch {
        // Следующая проверка через 4 секунды.
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status === "approved") {
      const timer = setTimeout(() => window.location.assign("/dashboard"), 1200);
      return () => clearTimeout(timer);
    }
  }, [status]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/auth/v2/login");
  }

  if (status === "rejected") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldX className="size-7" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-extrabold text-lg uppercase tracking-wide">Доступ отклонён</h2>
          <p className="text-muted-foreground text-sm">
            {name}, администратор не одобрил заявку. Если это ошибка, свяжитесь с куратором проекта.
          </p>
        </div>
        <button type="button" onClick={logout} className={authButtonClass}>
          <LogOut className="size-4" /> Выйти
        </button>
      </div>
    );
  }

  const done = status === "approved" ? 3 : 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="relative flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          {status === "pending" && <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />}
          {status === "approved" ? <Check className="relative size-7" /> : <Clock className="relative size-7" />}
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-extrabold text-lg uppercase tracking-wide">
            {status === "approved" ? "Доступ одобрен" : "Ожидаем одобрения"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {status === "approved" ? "Открываем панель…" : `${name}, заявка отправлена администратору.`}
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-3 rounded-xl bg-foreground/[0.05] p-4">
        {steps.map((step, index) => {
          const state = index < done ? "done" : index === done ? "current" : "todo";
          return (
            <li key={step.title} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  state === "done" && "bg-emerald-500 text-white",
                  state === "current" && "bg-primary text-primary-foreground",
                  state === "todo" && "bg-foreground/10 text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-3" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("font-medium text-sm", state === "todo" && "text-muted-foreground")}>{step.title}</p>
                <p className="text-muted-foreground text-xs">{step.text}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {status === "pending" && (
        <button type="button" onClick={logout} className="text-muted-foreground text-xs transition-colors hover:text-foreground">
          Выйти из аккаунта
        </button>
      )}
    </div>
  );
}
