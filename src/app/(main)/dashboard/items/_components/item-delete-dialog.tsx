"use client";

import { useTransition } from "react";

import { useRouter } from "next/navigation";

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

import { deleteItemAction } from "../_actions";
import type { Item } from "../_data/items";

type ItemDeleteDialogProps = {
  item: Item | null;
  onClose: () => void;
};

export function ItemDeleteDialog({ item, onClose }: ItemDeleteDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!item) return;
    startTransition(async () => {
      try {
        const result = await deleteItemAction(item.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Предмет удалён");
        onClose();
        router.refresh();
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <AlertDialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить предмет?</AlertDialogTitle>
          <AlertDialogDescription>
            Предмет «{item?.name}» (ID {item?.id}) исчезнет у всех посетителей. Это действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
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
