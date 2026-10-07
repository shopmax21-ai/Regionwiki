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

import { deleteReplyAction } from "../_actions";
import type { QuickReply } from "../_data/replies";
import { ReplyEditor } from "./reply-editor";

/** Кнопки «Изменить» и «Удалить» на карточке. */
export function ReplyActions({ reply, categories }: { reply: QuickReply; categories: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      try {
        const result = await deleteReplyAction(reply.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Ответ удалён");
        setOpen(false);
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <>
      <ReplyEditor mode="edit" reply={reply} categories={categories} />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Удалить ответ «${reply.title}»`}>
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить ответ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ответ «{reply.title}» исчезнет у всех. Это действие нельзя отменить.
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
    </>
  );
}
