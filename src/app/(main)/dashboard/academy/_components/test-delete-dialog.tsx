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
import type { TestCardData } from "@/lib/academy/types";

import { deleteTestAction } from "../_actions";

type TestDeleteDialogProps = {
  test: TestCardData | null;
  onClose: () => void;
};

export function TestDeleteDialog({ test, onClose }: TestDeleteDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!test) return;
    startTransition(async () => {
      try {
        const result = await deleteTestAction(test.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Тест удалён");
        onClose();
        router.refresh();
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <AlertDialog
      open={test !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить тест?</AlertDialogTitle>
          <AlertDialogDescription>
            Тест «{test?.title}» пропадёт из Академии. Уже сохранённые результаты останутся в разделе «Результаты
            тестов». Это действие нельзя отменить.
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
