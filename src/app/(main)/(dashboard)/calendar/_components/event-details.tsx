"use client";

import { CalendarClock, MapPin, Pencil, Trash2, UserRound } from "lucide-react";

import { PersonName } from "@/components/person-name";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRange, relativeTo } from "@/lib/calendar/format";
import { type CalendarEvent, statusOf } from "@/lib/calendar/types";

import { NotifySwitch } from "./notify-switch";
import { StatusBadge } from "./status-badge";

type EventDetailsProps = {
  event: CalendarEvent | null;
  now: number;
  meId: string;
  canManageAll: boolean;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onNotifyChanged: (id: string, notify: boolean) => void;
};

/** Карточка мероприятия: статус, время, автор, заметка, ползунок напоминания (у автора) и кнопки правки. */
export function EventDetails({
  event,
  now,
  meId,
  canManageAll,
  onClose,
  onEdit,
  onDelete,
  onNotifyChanged,
}: EventDetailsProps) {
  const status = event ? statusOf(event, now) : null;
  const mine = event?.ownerId === meId;
  const canChange = mine || canManageAll;

  let timing = "";
  if (event && status === "upcoming") timing = `Начнётся ${relativeTo(event.startsAt, now)}`;
  if (event && status === "live") timing = `Закончится ${relativeTo(event.endsAt, now)}`;
  if (event && status === "finished") timing = `Закончилось ${relativeTo(event.endsAt, now)}`;

  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onClose()}>
      {event && status && (
        <DialogContent className="gap-5 sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 pr-6">
              <StatusBadge status={status} />
              <span className="text-muted-foreground text-xs">{timing}</span>
            </div>
            <DialogTitle className="flex items-start gap-2 text-lg leading-snug">
              <span
                className="mt-1.5 size-3 shrink-0 rounded-full"
                style={{ backgroundColor: event.color }}
                role="img"
                aria-label="Цвет мероприятия"
              />
              {event.title}
            </DialogTitle>
            <DialogDescription className="sr-only">Сведения о мероприятии</DialogDescription>
          </DialogHeader>

          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="sr-only">Время</dt>
                <dd>{formatRange(event.startsAt, event.endsAt)} (МСК)</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="sr-only">Зарегистрировал</dt>
                <dd className="flex min-w-0 items-center gap-1">
                  <PersonName person={event.owner} />
                  {mine && <span className="text-muted-foreground"> (вы)</span>}
                </dd>
              </div>
            </div>
            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <dt className="sr-only">Место</dt>
                  <dd className="whitespace-pre-line">{event.location}</dd>
                </div>
              </div>
            )}
          </dl>

          {event.description && (
            <p className="whitespace-pre-line rounded-xl bg-muted/50 px-4 py-3 text-muted-foreground text-sm leading-6">
              {event.description}
            </p>
          )}

          {mine && status === "upcoming" && <NotifySwitch event={event} onChanged={onNotifyChanged} />}
          {!mine && status === "upcoming" && (
            <p className="text-muted-foreground text-xs">
              Напоминание в Telegram приходит автору мероприятия: {event.notify ? "оно включено" : "оно выключено"}.
            </p>
          )}

          {canChange && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => onEdit(event)}>
                <Pencil data-icon="inline-start" />
                Изменить
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(event)}
              >
                <Trash2 data-icon="inline-start" />
                Удалить
              </Button>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
