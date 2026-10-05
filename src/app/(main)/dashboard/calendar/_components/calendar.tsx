"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { useCalendarController } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import ruLocale from "@fullcalendar/react/locales/ru";
import multiMonthPlugin from "@fullcalendar/react/multimonth";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { differenceInCalendarDays, endOfMonth, format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Filter, Plus, XIcon } from "lucide-react";

import { EventCalendarViews } from "@/components/calendar/event-calendar-views";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pluralize } from "@/lib/academy/format";
import { type CalendarEvent, type EventStatus, MSK_ZONE, STATUS_LABELS, statusOf } from "@/lib/calendar/types";

import { EventDeleteDialog } from "./event-delete-dialog";
import { EventDetails } from "./event-details";
import { type EditorTarget, EventEditor } from "./event-editor";
import { EventList } from "./event-list";
import { STATUS_COLOR } from "./status-badge";

const views = [
  { key: "dayGridMonth", label: "Месяц" },
  { key: "timeGridWeek", label: "Неделя" },
  { key: "timeGridDay", label: "День" },
  { key: "listMonth", label: "Список" },
];

const plugins = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, multiMonthPlugin];

type OwnerFilter = "all" | "mine";
type StatusFilter = "all" | EventStatus;

type CalendarProps = {
  events: CalendarEvent[];
  /** Момент загрузки страницы на сервере: от него считаются статусы до первого тика, чтобы разметка совпала */
  serverNow: number;
  me: { id: string; canManageAll: boolean };
  /** Почему мероприятия не загрузились (null, если всё в порядке) */
  problem: string | null;
};

/** Обновляет «сейчас» раз в полминуты: статусы («идёт», «закончилось») меняются без перезагрузки страницы. */
function useNow(initial: number, intervalMs = 30_000) {
  const [now, setNow] = React.useState(initial);
  React.useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function Calendar({ events: initialEvents, serverNow, me, problem }: CalendarProps) {
  const router = useRouter();
  const controller = useCalendarController();
  const now = useNow(serverNow);

  // Ползунок напоминания применяется сразу, не дожидаясь обновления данных с сервера
  const [notifyOverrides, setNotifyOverrides] = React.useState<Record<string, boolean>>({});
  const events = React.useMemo(
    () =>
      initialEvents.map((event) =>
        event.id in notifyOverrides ? { ...event, notify: notifyOverrides[event.id] } : event,
      ),
    [initialEvents, notifyOverrides],
  );

  const [ownerFilter, setOwnerFilter] = React.useState<OwnerFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [editor, setEditor] = React.useState<EditorTarget | null>(null);
  const [deleting, setDeleting] = React.useState<CalendarEvent | null>(null);
  const [range, setRange] = React.useState(() => {
    const date = new Date();
    return {
      title: format(date, "LLLL yyyy", { locale: ru }),
      days: differenceInCalendarDays(endOfMonth(date), startOfMonth(date)) + 1,
      start: startOfMonth(date).getTime(),
      end: endOfMonth(date).getTime(),
    };
  });

  const visible = React.useMemo(
    () =>
      events.filter(
        (event) =>
          (ownerFilter === "all" || event.ownerId === me.id) &&
          (statusFilter === "all" || statusOf(event, now) === statusFilter),
      ),
    [events, ownerFilter, statusFilter, me.id, now],
  );

  const calendarEvents = React.useMemo(
    () =>
      visible.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startsAt,
        end: event.endsAt,
        color: STATUS_COLOR[statusOf(event, now)],
      })),
    [visible, now],
  );

  const inRange = visible.filter((event) => {
    const start = new Date(event.startsAt).getTime();
    return start >= range.start && start < range.end;
  }).length;

  const opened = events.find((event) => event.id === openId) ?? null;
  const filtered = ownerFilter !== "all" || statusFilter !== "all";

  const onNotifyChanged = (id: string, notify: boolean) =>
    setNotifyOverrides((current) => ({ ...current, [id]: notify }));
  const refresh = () => {
    setNotifyOverrides({});
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      {problem && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          Не удалось загрузить мероприятия: {problem}
        </p>
      )}

      <div className="flex flex-col overflow-hidden rounded-md border">
        <div className="flex flex-col gap-4 border-b bg-sidebar p-4 text-sidebar-foreground lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 shrink-0 flex-col gap-1">
            <div className="font-medium text-lg capitalize leading-none">{range.title}</div>
            <p className="text-muted-foreground text-sm">
              {range.days} {pluralize(range.days, ["день", "дня", "дней"])} · {inRange}{" "}
              {pluralize(inRange, ["мероприятие", "мероприятия", "мероприятий"])}
              {filtered ? " по фильтру" : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={ownerFilter} onValueChange={(value) => setOwnerFilter(value as OwnerFilter)}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Чьи мероприятия показывать">
                <Filter />
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value="all">Все администраторы</SelectItem>
                  <SelectItem value="mine">Только мои</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Статус мероприятий">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value="all">Любой статус</SelectItem>
                  {(Object.keys(STATUS_LABELS) as EventStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <ButtonGroup>
              <Button size="icon" variant="outline" onClick={() => controller.prev()} aria-label="Назад">
                <ChevronLeft />
              </Button>
              <Button variant="outline" onClick={() => controller.today()}>
                Сегодня
              </Button>
              <Button size="icon" variant="outline" onClick={() => controller.next()} aria-label="Вперёд">
                <ChevronRight />
              </Button>
            </ButtonGroup>
            <Select
              value={controller.view?.type ?? views[0].key}
              onValueChange={(value) => {
                controller.changeView(value);
              }}
            >
              <SelectTrigger aria-label="Вид календаря">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {views.map((view) => (
                    <SelectItem key={view.key} value={view.key}>
                      {view.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button onClick={() => setEditor({ mode: "create" })}>
              <Plus />
              Зарегистрировать
            </Button>
          </div>
        </div>

        <EventCalendarViews
          controller={controller}
          initialView={views[0].key}
          plugins={[...plugins]}
          locale={ruLocale}
          timeZone={MSK_ZONE}
          popoverCloseContent={() => <XIcon className="size-5 text-muted-foreground group-hover:text-foreground" />}
          events={calendarEvents}
          nowIndicator
          eventClick={(info) => setOpenId(info.event.id)}
          dateClick={(info) => {
            // Клик по дню: регистрация с подставленной датой. Для всего дня берём 12:00 по Москве.
            const iso = info.allDay ? `${info.dateStr.slice(0, 10)}T12:00:00+03:00` : info.date.toISOString();
            setEditor({ mode: "create", startsAt: new Date(iso).toISOString() });
          }}
          datesSet={(info) => {
            setRange({
              title: info.view.title,
              days: differenceInCalendarDays(info.view.currentEnd, info.view.currentStart),
              start: info.start.getTime(),
              end: info.end.getTime(),
            });
          }}
        />
      </div>

      <EventList
        events={visible}
        now={now}
        meId={me.id}
        onOpen={(event) => setOpenId(event.id)}
        onNotifyChanged={onNotifyChanged}
      />

      <EventDetails
        event={opened}
        now={now}
        meId={me.id}
        canManageAll={me.canManageAll}
        onClose={() => setOpenId(null)}
        onEdit={(event) => {
          setOpenId(null);
          setEditor({ mode: "edit", event });
        }}
        onDelete={(event) => {
          setOpenId(null);
          setDeleting(event);
        }}
        onNotifyChanged={onNotifyChanged}
      />

      <EventEditor
        target={editor}
        events={events}
        now={now}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null);
          refresh();
        }}
      />

      <EventDeleteDialog
        event={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          refresh();
        }}
      />
    </div>
  );
}
