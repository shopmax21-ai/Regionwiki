"use client";

import { useState, useTransition } from "react";

import { BellRing } from "lucide-react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { setMediaNotificationsAction } from "../_actions";

/** Личная настройка администратора: получать в Telegram сообщение, когда отслеживаемый канал начинает трансляцию. */
export function NotifySwitch({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const change = (value: boolean) => {
    setEnabled(value);
    startTransition(async () => {
      const result = await setMediaNotificationsAction(value).catch(() => ({
        ok: false as const,
        error: "Нет связи с сервером, попробуйте ещё раз",
      }));
      if (!result.ok) {
        setEnabled(!value);
        toast.error(result.error);
        return;
      }
      toast.success(value ? "Оповещения о трансляциях включены" : "Оповещения о трансляциях выключены");
    });
  };

  return (
    <Label className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 font-normal text-sm">
      <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
      Оповещать меня в Telegram
      <Switch
        checked={enabled}
        onCheckedChange={change}
        disabled={pending}
        aria-label="Оповещать меня в Telegram о начале трансляций"
      />
    </Label>
  );
}
