"use client";

import { useTransition } from "react";

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
} from "@/components/ui/alert-dialog";
import type { CalendarEvent } from "@/lib/calendar/types";

import { deleteEventAction } from "../_actions";

export function EventDeleteDialog({
  event,
  onClose,
  onDeleted,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!event) return;
    startTransition(async () => {
      try {
        const result = await deleteEventAction(event.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Мероприятие удалено");
        onDeleted();
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <AlertDialog
      open={event !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить мероприятие?</AlertDialogTitle>
          <AlertDialogDescription>
            Мероприятие «{event?.title}» исчезнет из календаря у всех администраторов, время снова станет свободным. Это
            действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(click) => {
              click.preventDefault();
              remove();
            }}
          >
            {pending ? "Удаление..." : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
