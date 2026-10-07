"use client";

import { useState, useTransition } from "react";

import { BellRing } from "lucide-react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { setCalendarTrackingAction } from "../_actions";

/**
 * «Следить за календарём в Telegram»: личная настройка администратора. Включённая, она присылает сообщения о новых,
 * изменённых и удалённых мероприятиях и напоминание за час до начала чужих мероприятий. Состояние меняется сразу
 * и откатывается, если сервер отказал.
 */
export function TrackingSwitch({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const change = (value: boolean) => {
    setEnabled(value);
    startTransition(async () => {
      const result = await setCalendarTrackingAction(value).catch(() => ({
        ok: false as const,
        error: "Нет связи с сервером, попробуйте ещё раз",
      }));
      if (!result.ok) {
        setEnabled(!value);
        toast.error(result.error);
        return;
      }
      toast.success(value ? "Слежение за календарём включено" : "Слежение за календарём выключено");
    });
  };

  return (
    <Label className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 px-4 py-3 font-normal">
      <span className="flex min-w-0 items-start gap-3">
        <BellRing className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">Следить за календарём в Telegram</span>
          <span className="font-normal text-muted-foreground text-xs">
            Бот напишет, когда мероприятие добавят, перенесут или удалят, и напомнит за час до начала. Бот должен быть
            не заблокирован.
          </span>
        </span>
      </span>
      <Switch
        checked={enabled}
        onCheckedChange={change}
        disabled={pending}
        aria-label="Следить за календарём в Telegram"
      />
    </Label>
  );
}
