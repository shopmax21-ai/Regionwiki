"use client";

import { useId, useState, useTransition } from "react";

import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createReplyAction, updateReplyAction } from "../_actions";
import { type QuickReply, REPLY_LIMITS } from "../_data/replies";

type FormState = { category: string; title: string; text: string };

const emptyForm: FormState = { category: "", title: "", text: "" };

type ReplyEditorProps = {
  categories: readonly string[];
  /** Категория, подставляемая при добавлении (например, выбранная в фильтре) */
  defaultCategory?: string;
} & ({ mode: "create" } | { mode: "edit"; reply: QuickReply });

/** Кнопка и окно добавления или изменения ответа. Показывается только тем, у кого есть право редактирования. */
export function ReplyEditor(props: ReplyEditorProps) {
  const { categories } = props;
  const editing = props.mode === "edit";
  const fieldId = useId();
  const listId = `${fieldId}-categories`;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setForm(
        props.mode === "edit"
          ? { category: props.reply.category, title: props.reply.title, text: props.reply.text }
          : { ...emptyForm, category: props.defaultCategory ?? "" },
      );
      setError(null);
    }
    setOpen(next);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result =
          props.mode === "edit" ? await updateReplyAction(props.reply.id, form) : await createReplyAction(form);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(editing ? "Изменения сохранены" : "Ответ добавлен");
        setOpen(false);
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Изменить ответ «${props.reply.title}»`}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" /> Добавить ответ
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Изменение ответа" : "Новый быстрый ответ"}</DialogTitle>
          <DialogDescription>Изменения сразу увидят все, у кого есть доступ к разделу.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-category`}>Категория</Label>
              <Input
                id={`${fieldId}-category`}
                list={listId}
                value={form.category}
                maxLength={REPLY_LIMITS.category}
                onChange={(event) => set("category", event.target.value)}
                placeholder="Например, Уточнение"
                autoComplete="off"
              />
              <datalist id={listId}>
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-title`}>Название</Label>
              <Input
                id={`${fieldId}-title`}
                value={form.title}
                maxLength={REPLY_LIMITS.title}
                onChange={(event) => set("title", event.target.value)}
                placeholder="Коротко, чтобы быстро найти"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-text`}>Текст ответа</Label>
            <Textarea
              id={`${fieldId}-text`}
              value={form.text}
              maxLength={REPLY_LIMITS.text}
              onChange={(event) => set("text", event.target.value)}
              placeholder="Этот текст скопируется по нажатию на карточку"
              className="max-h-64 min-h-28"
            />
            <p className="text-right text-muted-foreground text-xs tabular-nums">
              {form.text.length} / {REPLY_LIMITS.text}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
