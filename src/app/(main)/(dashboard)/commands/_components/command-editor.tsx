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

import { createCommandAction, updateCommandAction } from "../_actions";
import { COMMAND_LEVEL_MAX, COMMAND_LIMITS, levelLabel, type ServerCommand } from "../_data/commands";

type FormState = { level: number; command: string; argument: string; description: string };

const emptyForm: FormState = { level: 1, command: "", argument: "", description: "" };

const LEVELS = Array.from({ length: COMMAND_LEVEL_MAX }, (_, index) => index + 1);

type CommandEditorProps = { mode: "create"; defaultLevel?: number } | { mode: "edit"; item: ServerCommand };

/** Кнопка и окно добавления или изменения команды. Показывается только тем, у кого есть право редактирования. */
export function CommandEditor(props: CommandEditorProps) {
  const editing = props.mode === "edit";
  const fieldId = useId();

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
          ? {
              level: props.item.level,
              command: props.item.command,
              argument: props.item.argument,
              description: props.item.description,
            }
          : { ...emptyForm, level: props.defaultLevel ?? 1 },
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
          props.mode === "edit" ? await updateCommandAction(props.item.id, form) : await createCommandAction(form);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(editing ? "Изменения сохранены" : "Команда добавлена");
        setOpen(false);
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {props.mode === "edit" ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Изменить команду ${props.item.command}`}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" /> Добавить команду
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Изменение команды" : "Новая команда"}</DialogTitle>
          <DialogDescription>Изменения сразу увидят все администраторы.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-level`}>Уровень</Label>
              <select
                id={`${fieldId}-level`}
                value={form.level}
                onChange={(event) => set("level", Number(event.target.value))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {levelLabel(level)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-command`}>Команда</Label>
              <Input
                id={`${fieldId}-command`}
                value={form.command}
                maxLength={COMMAND_LIMITS.command}
                onChange={(event) => set("command", event.target.value.replace(/\s/g, ""))}
                placeholder="/ban"
                autoComplete="off"
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-argument`}>Аргумент</Label>
            <Input
              id={`${fieldId}-argument`}
              value={form.argument}
              maxLength={COMMAND_LIMITS.argument}
              onChange={(event) => set("argument", event.target.value)}
              placeholder="[ID] [дни] [причина]"
              autoComplete="off"
              className="font-mono"
            />
            <p className="text-muted-foreground text-xs">Необязательно: оставьте пустым, если у команды нет аргументов.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-description`}>Описание</Label>
            <Textarea
              id={`${fieldId}-description`}
              value={form.description}
              maxLength={COMMAND_LIMITS.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder="Что делает команда"
              className="max-h-48 min-h-20"
            />
            <p className="text-right text-muted-foreground text-xs tabular-nums">
              {form.description.length} / {COMMAND_LIMITS.description}
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
