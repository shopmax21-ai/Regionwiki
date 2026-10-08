"use client";

import { useTransition } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { forceRulesSync } from "../_actions";

/** Кнопка принудительного обновления правил для Гл.Администратора. Ставится рядом с блоком статуса. */
export function RuleRefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refresh = () =>
    startTransition(async () => {
      const result = await forceRulesSync();
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <Button
      type="button"
      variant="outline"
      onClick={refresh}
      disabled={pending}
      title="Принудительно обновить правила (только Гл.Администратор)"
      aria-label="Принудительно обновить правила"
      className={cn("h-auto self-stretch rounded-xl px-3", className)}
    >
      <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden="true" />
      <span className="hidden sm:inline">{pending ? "Обновление…" : "Обновить"}</span>
    </Button>
  );
}
