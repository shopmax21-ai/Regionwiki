"use client";

import { useState, useTransition } from "react";

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

import { deleteCommandAction } from "../_actions";
import type { ServerCommand } from "../_data/commands";
import { CommandEditor } from "./command-editor";

/** Кнопки «Изменить» и «Удалить» в строке таблицы. */
export function CommandActions({ item }: { item: ServerCommand }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      try {
        const result = await deleteCommandAction(item.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Команда удалена");
        setOpen(false);
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <div className="flex items-center gap-0.5">
      <CommandEditor mode="edit" item={item} />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Удалить команду ${item.command}`}>
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить команду?</AlertDialogTitle>
            <AlertDialogDescription>
              Команда {item.command} исчезнет у всех. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                // Окно закроется само после ответа сервера
                event.preventDefault();
                remove();
              }}
            >
              {pending ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
