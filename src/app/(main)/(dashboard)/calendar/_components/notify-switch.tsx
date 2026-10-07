"use client";

import { useState, useTransition } from "react";

import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CalendarEvent } from "@/lib/calendar/types";

import { setEventNotifyAction } from "../_actions";

/**
 * Ползунок «Напомнить в Telegram за час до начала». Переключает его только автор мероприятия: сообщение приходит
 * ему. Состояние меняется сразу и откатывается, если сервер отказал.
 */
export function NotifySwitch({
  event,
  onChanged,
  compact = false,
}: {
  event: CalendarEvent;
  onChanged?: (id: string, notify: boolean) => void;
  compact?: boolean;
}) {
  const [checked, setChecked] = useState(event.notify);
  const [pending, startTransition] = useTransition();

  // Если мероприятие обновилось снаружи (например, правкой), берём новое значение
  const [seen, setSeen] = useState(event.notify);
  if (seen !== event.notify) {
    setSeen(event.notify);
    setChecked(event.notify);
  }

  const change = (value: boolean) => {
    setChecked(value);
    startTransition(async () => {
      const result = await setEventNotifyAction(event.id, value).catch(() => ({
        ok: false as const,
        error: "Нет связи с сервером, попробуйте ещё раз",
      }));
      if (!result.ok) {
        setChecked(!value);
        toast.error(result.error);
        return;
      }
      onChanged?.(event.id, value);
      toast.success(value ? "Напомним в Telegram за час до начала" : "Напоминание выключено");
    });
  };

  if (compact) {
    return (
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={change}
        disabled={pending}
        aria-label={`Напоминание в Telegram: ${event.title}`}
      />
    );
  }

  const Icon = checked ? Bell : BellOff;
  return (
    <Label className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3 font-normal">
      <span className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">Напомнить в Telegram за час до начала</span>
          <span className="font-normal text-muted-foreground text-xs">
            {event.reminded && checked
              ? "Напоминание уже отправлено."
              : "Сообщение придёт вам от бота. Он должен быть не заблокирован."}
          </span>
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={change} disabled={pending} aria-label="Напоминание в Telegram" />
    </Label>
  );
}
