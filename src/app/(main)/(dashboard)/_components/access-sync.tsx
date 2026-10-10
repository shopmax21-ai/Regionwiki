"use client";

import { useEffect, useRef } from "react";

import { useRouter } from "next/navigation";

const POLL_MS = 15_000;

/**
 * Следит за изменением роли, группы, прав и статуса доступа текущего пользователя.
 * Когда администратор что-то поменял, страница перерисовывается на месте (router.refresh): без перезагрузки,
 * без потери введённого текста и без повторного входа. Опрос идёт только пока вкладка открыта.
 */
export function AccessSync({ accessKey }: { readonly accessKey: string }) {
  const router = useRouter();
  const current = useRef(accessKey);
  const busy = useRef(false);

  useEffect(() => {
    current.current = accessKey;
  }, [accessKey]);

  useEffect(() => {
    let stopped = false;

    const check = async () => {
      if (busy.current || document.visibilityState !== "visible") return;
      busy.current = true;
      try {
        const res = await fetch("/api/auth/access", { cache: "no-store" });
        // Сессия закончилась (например, «Выйти на всех устройствах»): перерисовка покажет кнопку «Войти»
        if (res.status === 401) return void router.refresh();
        if (!res.ok) return;
        const data = (await res.json()) as { key?: string | null };
        if (!stopped && typeof data.key === "string" && data.key !== current.current) {
          current.current = data.key;
          router.refresh();
        }
      } catch {
        // Нет сети: проверим при следующем тике
      } finally {
        busy.current = false;
      }
    };

    const timer = setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [router]);

  return null;
}
