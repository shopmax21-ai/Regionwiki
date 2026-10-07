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

const contentClass = "data-[size=default]:sm:max-w-md";
const headerClass = "sm:group-data-[size=default]/alert-dialog-content:place-items-start";
const footerClass = "flex-col sm:flex-col sm:justify-stretch";

/** Вопрос «Закрыть без сохранения?», когда в форме есть несохранённые правки. */
export function ConfirmCloseDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={contentClass}>
        <AlertDialogHeader className={headerClass}>
          <AlertDialogTitle>Закрыть без сохранения?</AlertDialogTitle>
          <AlertDialogDescription>В форме есть несохранённые изменения, они пропадут.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={footerClass}>
          <AlertDialogCancel className="w-full">Продолжить редактирование</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Закрыть без сохранения
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type DeleteRecordButtonProps = {
  /** Адрес, на который уходит запрос DELETE */
  endpoint: string;
  /** Что именно удаляем, в родительном падеже: «бизнес», «объект» */
  noun: string;
  /** Как называется запись в окне подтверждения: «Банкомат #5» */
  name: string;
  successMessage: string;
  /** Компактная кнопка-иконка (для карточек) вместо кнопки с подписью */
  iconOnly?: boolean;
};

/** Кнопка удаления с подтверждением. После удаления страница обновляется. */
export function DeleteRecordButton({ endpoint, noun, name, successMessage, iconOnly }: DeleteRecordButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? `Не удалось удалить ${noun}`);
        return;
      }
      toast.success(successMessage);
      setOpen(false);
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
        {iconOnly ? (
          <Button
            type="button"
            size="icon-xs"
            variant="secondary"
            aria-label={`Удалить: ${name}`}
            title="Удалить"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive">
            <Trash2 data-icon="inline-start" /> Удалить
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className={contentClass}>
        <AlertDialogHeader className={headerClass}>
          <AlertDialogTitle>Удалить {noun}?</AlertDialogTitle>
          <AlertDialogDescription>
            «{name}» исчезнет из каталога и из поиска по сайту. Это действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={footerClass}>
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
