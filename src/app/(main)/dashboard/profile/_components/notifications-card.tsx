"use client";

import { useState, useTransition } from "react";

import { Bell } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { setRequestNotifications } from "../_actions";

/** Переключатель уведомлений о новых заявках. Показывается только тем, кто может рассматривать заявки. */
export function NotificationsCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const change = (value: boolean) => {
    setEnabled(value);
    startTransition(async () => {
      const result = await setRequestNotifications(value).catch(() => ({
        ok: false as const,
        error: "Нет связи с сервером, попробуйте ещё раз",
      }));
      if (!result.ok) {
        setEnabled(!value);
        toast.error(result.error);
      } else {
        toast.success(value ? "Уведомления включены" : "Уведомления выключены");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="size-4" aria-hidden="true" />Уведомления</CardTitle>
        <CardDescription>Сообщения от бота в Telegram, когда кто-то подаёт заявку на доступ.</CardDescription>
      </CardHeader>
      <CardContent>
        <Label className="flex items-center justify-between gap-4 font-normal">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-sm">Новые заявки на доступ</span>
            <span className="text-muted-foreground text-xs">
              В сообщении будут кнопки «Одобрить» и «Отклонить». Бот должен быть не заблокирован.
            </span>
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={change}
            disabled={pending}
            aria-label="Уведомления о новых заявках"
          />
        </Label>
      </CardContent>
    </Card>
  );
}
