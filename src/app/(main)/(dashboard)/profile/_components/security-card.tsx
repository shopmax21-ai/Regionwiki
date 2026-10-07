"use client";

import { useState, useTransition } from "react";

import { LogOut } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LOGIN_PATH } from "@/lib/auth/config";

import { logoutEverywhere } from "../_actions";

export function SecurityCard() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () => {
    startTransition(async () => {
      const result = await logoutEverywhere().catch(() => ({
        ok: false as const,
        error: "Нет связи с сервером, попробуйте ещё раз",
      }));
      if (result.ok) {
        window.location.assign(LOGIN_PATH);
        return;
      }
      toast.error(result.error);
      setOpen(false);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Безопасность</CardTitle>
        <CardDescription>
          Если вы входили с чужого или общего устройства, завершите все сессии. Войти снова можно с новым кодом из
          Telegram.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <LogOut data-icon="inline-start" /> Выйти на всех устройствах
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Выйти на всех устройствах?</AlertDialogTitle>
              <AlertDialogDescription>
                Все сессии аккаунта, включая эту, будут завершены. На других устройствах это произойдёт в течение
                нескольких секунд.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                onClick={(event) => {
                  event.preventDefault();
                  run();
                }}
              >
                {pending ? "Выходим..." : "Выйти везде"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
