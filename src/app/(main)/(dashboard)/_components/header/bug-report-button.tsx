"use client";

import { useId, useState, useTransition } from "react";

import { usePathname } from "next/navigation";

import { Bug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BUG_LIMITS } from "@/lib/bugs/types";

import { submitBugAction } from "../../bugs/_actions";

/**
 * Кнопка «Сообщить об ошибке» в шапке: только иконка, подпись в подсказке. Окно отправки открывается по клику.
 * Отправлять могут все (гостям лимит меньше), читают сообщения только те, у кого есть право.
 */
export function BugReportButton() {
  const pathname = usePathname();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    if (next) setError(null);
    setOpen(next);
  };

  const send = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitBugAction({ title, description, pagePath: pathname });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success("Спасибо! Баг-репорт отправлен администрации");
        setTitle("");
        setDescription("");
        setOpen(false);
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" aria-label="Сообщить об ошибке" onClick={() => handleOpenChange(true)}>
            <Bug />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Сообщить об ошибке</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Сообщить об ошибке</DialogTitle>
            <DialogDescription>Опишите, что пошло не так. Сообщение увидит только администрация.</DialogDescription>
          </DialogHeader>

          {
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-title`}>Коротко о проблеме</Label>
                <Input
                  id={`${fieldId}-title`}
                  value={title}
                  maxLength={BUG_LIMITS.title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Например, не открывается карточка транспорта"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-description`}>Подробности</Label>
                <Textarea
                  id={`${fieldId}-description`}
                  value={description}
                  maxLength={BUG_LIMITS.description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Что вы делали, что ожидали увидеть и что получилось"
                  className="max-h-64 min-h-28"
                />
                <p className="text-right text-muted-foreground text-xs tabular-nums">
                  {description.length} / {BUG_LIMITS.description}
                </p>
              </div>
              <p className="text-muted-foreground text-xs">
                Вместе с сообщением сохранится страница, на которой вы сейчас: <code>{pathname}</code>
              </p>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
            </div>
          }

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Отмена
            </Button>
            <Button onClick={send} disabled={pending}>
              {pending ? "Отправка..." : "Отправить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
