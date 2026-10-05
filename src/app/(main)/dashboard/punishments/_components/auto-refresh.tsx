"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

/**
 * Обновляет данные страницы раз в полминуты, пока вкладка открыта: новая заявка появляется в очереди,
 * а статус «Выдано» у хелпера без перезагрузки. Состояние форм и открытых окон при этом не сбрасывается.
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
