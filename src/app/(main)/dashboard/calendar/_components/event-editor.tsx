"use client";

import { useId, useMemo, useState, useTransition } from "react";

import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { PersonName } from "@/components/person-name";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatRange, fromInputValue, nextFullHour, toInputValue } from "@/lib/calendar/format";
import {
  type CalendarEvent,
  type ConflictInfo,
  EVENT_LIMITS as L,
  overlaps,
  REMINDER_LEAD_MINUTES,
} from "@/lib/calendar/types";

import { createEventAction, updateEventAction } from "../_actions";

/** Что открыть в редакторе: новое мероприятие (можно с заранее выбранным началом) или правка существующего */
export type EditorTarget = { mode: "create"; startsAt?: string } | { mode: "edit"; event: CalendarEvent };

type FormState = { title: string; description: string; location: string; start: string; end: string; notify: boolean };

function initialForm(target: EditorTarget, now: number): FormState {
  if (target.mode === "edit") {
    const { event } = target;
    return {
      title: event.title,
      description: event.description,
      location: event.location,
      start: toInputValue(event.startsAt),
      end: toInputValue(event.endsAt),
      notify: event.notify,
    };
  }
  const start = target.startsAt ?? nextFullHour(now);
  return {
    title: "",
    description: "",
    location: "",
    start: toInputValue(start),
    end: toInputValue(new Date(new Date(start).getTime() + 3_600_000).toISOString()),
    notify: true,
  };
}

type EventEditorProps = {
  target: EditorTarget | null;
  /** Все известные мероприятия: по ним сразу, пока заполняется форма, видно пересечения */
  events: CalendarEvent[];
  now: number;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Окно регистрации и правки мероприятия. Пересечения с другими мероприятиями видны сразу при выборе времени:
 * администратор решает, сдвинуть ли время или всё равно записать (например, мероприятия идут параллельно).
 */
export function EventEditor({ target, events, now, onClose, onSaved }: EventEditorProps) {
  // Форма пересоздаётся при каждом открытии, поэтому ключ зависит от цели
  let key = "closed";
  if (target?.mode === "edit") key = `edit-${target.event.id}`;
  else if (target) key = `create-${target.startsAt ?? "now"}`;
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target && <EditorBody key={key} target={target} events={events} now={now} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function EditorBody({
  target,
  events,
  now,
  onClose,
  onSaved,
}: { target: EditorTarget } & Omit<EventEditorProps, "target">) {
  const editing = target.mode === "edit";
  const fieldId = useId();
  const id = (name: string) => `${fieldId}-${name}`;

  const [form, setForm] = useState<FormState>(() => initialForm(target, now));
  const [error, setError] = useState<string | null>(null);
  const [serverConflicts, setServerConflicts] = useState<ConflictInfo[] | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(name: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setServerConflicts(null);
  };

  const startsAt = fromInputValue(form.start);
  const endsAt = fromInputValue(form.end);
  const rangeValid = startsAt !== null && endsAt !== null && new Date(endsAt) > new Date(startsAt);

  const editingId = editing ? target.event.id : null;
  const localConflicts = useMemo<ConflictInfo[]>(() => {
    if (!rangeValid || startsAt === null || endsAt === null) return [];
    return events.filter((event) => event.id !== editingId && overlaps(event, { startsAt, endsAt }));
  }, [events, editingId, rangeValid, startsAt, endsAt]);

  const conflicts = serverConflicts ?? localConflicts;
  const startsSoon =
    form.notify && startsAt !== null && new Date(startsAt).getTime() - now < REMINDER_LEAD_MINUTES * 60_000;
  const startInPast = startsAt !== null && new Date(startsAt).getTime() < now - 60_000;

  const submit = () => {
    if (startsAt === null || endsAt === null) {
      setError("Укажите дату и время начала и окончания");
      return;
    }
    setError(null);
    startTransition(async () => {
      const payload = {
        title: form.title,
        description: form.description,
        location: form.location,
        startsAt,
        endsAt,
        notify: form.notify,
        // Администратор уже видел пересечения на экране и подтвердил кнопкой «Всё равно сохранить»
        force: conflicts.length > 0,
      };
      try {
        const result =
          target.mode === "edit" ? await updateEventAction(target.event.id, payload) : await createEventAction(payload);
        if (!result.ok) {
          if (result.conflicts) setServerConflicts(result.conflicts);
          setError(
            result.conflicts ? "Пока вы заполняли форму, время занял кто-то ещё. Проверьте список ниже." : result.error,
          );
          return;
        }
        toast.success(editing ? "Мероприятие сохранено" : "Мероприятие зарегистрировано");
        onSaved();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  let submitLabel = editing ? "Сохранить" : "Зарегистрировать";
  if (conflicts.length > 0) submitLabel = editing ? "Всё равно сохранить" : "Всё равно зарегистрировать";
  if (pending) submitLabel = "Сохранение...";

  return (
    <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{editing ? "Изменить мероприятие" : "Новое мероприятие"}</DialogTitle>
        <DialogDescription>
          Время указывается по Москве. Мероприятие увидят все администраторы, чтобы не назначать другое на это время.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor={id("title")}>Название</Label>
          <Input
            id={id("title")}
            value={form.title}
            maxLength={L.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="Например, «Собеседование на хелпера»"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("start")}>Начало</Label>
          <Input
            id={id("start")}
            type="datetime-local"
            value={form.start}
            onChange={(event) => {
              const value = event.target.value;
              // Длительность сохраняется: при сдвиге начала конец едет следом
              const oldStart = fromInputValue(form.start);
              const oldEnd = fromInputValue(form.end);
              const nextStart = fromInputValue(value);
              if (oldStart && oldEnd && nextStart) {
                const span = new Date(oldEnd).getTime() - new Date(oldStart).getTime();
                const shifted = span > 0 ? new Date(new Date(nextStart).getTime() + span).toISOString() : null;
                setForm((prev) => ({ ...prev, start: value, end: shifted ? toInputValue(shifted) : prev.end }));
                setServerConflicts(null);
                return;
              }
              set("start", value);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("end")}>Окончание</Label>
          <Input
            id={id("end")}
            type="datetime-local"
            value={form.end}
            min={form.start}
            onChange={(event) => set("end", event.target.value)}
            aria-invalid={startsAt !== null && endsAt !== null && !rangeValid}
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor={id("location")}>Место (необязательно)</Label>
          <Input
            id={id("location")}
            value={form.location}
            maxLength={L.location}
            onChange={(event) => set("location", event.target.value)}
            placeholder="Голосовой канал, точка на карте, сервер..."
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor={id("description")}>Заметка (необязательно)</Label>
          <Textarea
            id={id("description")}
            value={form.description}
            maxLength={L.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="Кто участвует, что подготовить"
            className="min-h-20"
          />
        </div>
      </div>

      {startsAt !== null && endsAt !== null && !rangeValid && (
        <p role="alert" className="text-destructive text-sm">
          Окончание должно быть позже начала.
        </p>
      )}

      {conflicts.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            Это время пересекается с другими мероприятиями
          </p>
          <ul className="flex flex-col gap-1">
            {conflicts.map((conflict) => (
              <li key={conflict.id} className="text-muted-foreground text-xs leading-5">
                <span className="font-medium text-foreground">{conflict.title}</span> ·{" "}
                <PersonName person={conflict.owner} className="align-bottom" /> ·{" "}
                {formatRange(conflict.startsAt, conflict.endsAt)}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Сдвиньте время или сохраните, если мероприятия идут параллельно.
          </p>
        </div>
      )}

      <Label className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3 font-normal">
        <span className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">Напомнить в Telegram за час до начала</span>
          <span className="font-normal text-muted-foreground text-xs">
            {startsSoon && !startInPast
              ? "До начала меньше часа: напоминание придёт в течение минуты."
              : "Сообщение придёт вам от бота. Включить и выключить можно и потом."}
          </span>
        </span>
        <Switch
          checked={form.notify}
          onCheckedChange={(value) => set("notify", value)}
          aria-label="Напоминание в Telegram"
        />
      </Label>

      {startInPast && (
        <p className="text-muted-foreground text-xs">
          Начало в прошлом: мероприятие сразу попадёт в «Закончилось» или «Идёт».
        </p>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Отмена
        </Button>
        <Button type="button" onClick={submit} disabled={pending || !rangeValid}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
