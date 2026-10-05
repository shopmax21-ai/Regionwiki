"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Trash2 } from "lucide-react";
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

/** Удаление транспорта с подтверждением. После удаления возвращает в каталог. */
export function VehicleDelete({ code, title }: { code: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(`/api/vehicles/${encodeURIComponent(code)}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Не удалось удалить транспорт");
        return;
      }
      toast.success("Транспорт удалён");
      setOpen(false);
      router.push("/dashboard/transport");
      router.refresh();
    } catch {
      toast.error("Нет связи с сервером, попробуйте ещё раз");
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 data-icon="inline-start" /> Удалить
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <AlertDialogHeader className="sm:group-data-[size=default]/alert-dialog-content:place-items-start">
          <AlertDialogTitle>Удалить транспорт?</AlertDialogTitle>
          <AlertDialogDescription>
            «{title}» исчезнет из каталога и по адресу /dashboard/transport/{code} откроется страница «не найдено». Это
            действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col sm:justify-stretch">
          <AlertDialogCancel disabled={pending} className="w-full">
            Отмена
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            className="w-full"
            onClick={(event) => {
              event.preventDefault();
              void remove();
            }}
          >
            {pending ? "Удаление..." : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
