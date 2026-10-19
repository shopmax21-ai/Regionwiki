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
import { Cake, ChevronLeft, ChevronRight, Filter, Plus, Radio, XIcon } from "lucide-react";

import { EventCalendarViews } from "@/components/calendar/event-calendar-views";
import { PersonName } from "@/components/person-name";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Person } from "@/lib/auth/person";
import { pluralize } from "@/lib/academy/format";
import { birthdayInYear, type CalendarBirthday, mskDateParts } from "@/lib/birthdays/types";
import {
  type CalendarEvent,
  type EventStatus,
  MSK_ZONE,
  readableTextOn,
  STATUS_LABELS,
  statusOf,
} from "@/lib/calendar/types";
import type { MediaPrEntry } from "@/lib/mediapr/types";

import { EventDeleteDialog } from "./event-delete-dialog";
import { EventDetails } from "./event-details";
import { type EditorTarget, EventEditor } from "./event-editor";
import { EventList } from "./event-list";
import { MediaPanel } from "./media-panel";
import { TrackingSwitch } from "./tracking-switch";

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
  /** Дни рождения администраторов: повторяются каждый год */
  birthdays: CalendarBirthday[];
  /** Момент загрузки страницы на сервере: от него считаются статусы до первого тика, чтобы разметка совпала */
  serverNow: number;
  me: { id: string; canManageAll: boolean; canMedia: boolean };
  /** Таблица «Медиа PR» для вкладки «Медиа» (null, если доступа нет) */
  mediaEntries: MediaPrEntry[] | null;
  mediaProblem: string | null;
  /** Включено ли у этого администратора слежение за календарём в Telegram */
  tracking: boolean;
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

const BIRTHDAY_COLOR = "#ec4899";
const BIRTHDAY_ID = "birthday:";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Именинники списком: у каждого Никнейм, иконка роли и приглушённый Static ID. */
function BirthdayPeople({ people }: { people: Person[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 align-middle text-foreground">
      {people.map((person) => (
        <PersonName key={person.id} person={person} />
      ))}
    </span>
  );
}

export function Calendar({
  events: initialEvents,
  birthdays,
  serverNow,
  me,
  tracking,
  problem,
  mediaEntries,
  mediaProblem,
}: CalendarProps) {
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
  // Общий календарь (без медиа) или календарь медиа: переключается кнопкой, доступно сотрудникам медиа
  const [mode, setMode] = React.useState<"general" | "media">("general");
  const activeMode = me.canMedia ? mode : "general";
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
          event.category === activeMode &&
          (ownerFilter === "all" || event.ownerId === me.id) &&
          (statusFilter === "all" || statusOf(event, now) === statusFilter),
      ),
    [events, activeMode, ownerFilter, statusFilter, me.id, now],
  );

  // Дни рождения видны в общем календаре без фильтров: за год до и после текущего, чтобы листать без перезагрузки
  const birthdayEvents = React.useMemo(() => {
    if (activeMode !== "general" || ownerFilter !== "all" || statusFilter !== "all") return [];
    const year = mskDateParts(now).year;
    return birthdays.flatMap((person) =>
      [year - 1, year, year + 1].flatMap((y) => {
        const date = birthdayInYear(person.birthday, y);
        return date
          ? [
              {
                id: `${BIRTHDAY_ID}${person.id}:${y}`,
                title: `🎂 ${person.label}`,
                start: date,
                allDay: true,
                color: BIRTHDAY_COLOR,
                textColor: "#ffffff",
              },
            ]
          : [];
      }),
    );
  }, [birthdays, activeMode, ownerFilter, statusFilter, now]);

  // Сегодня и завтра: подсказка над календарём, чтобы не пропустить
  const upcomingBirthdays = React.useMemo(() => {
    const today = mskDateParts(now);
    const tomorrow = mskDateParts(now + DAY_MS);
    const on = (parts: typeof today) =>
      birthdays.filter((person) => birthdayInYear(person.birthday, parts.year) === parts.key).map((p) => p.person);
    return { today: on(today), tomorrow: on(tomorrow) };
  }, [birthdays, now]);

  const calendarEvents = React.useMemo(
    () => [
      ...birthdayEvents,
      ...visible.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startsAt,
        end: event.endsAt,
        // Цвет выбирает автор мероприятия; закончившиеся приглушаются, чтобы текущие и будущие были заметнее
        color: event.color,
        textColor: readableTextOn(event.color),
        classNames: statusOf(event, now) === "finished" ? ["opacity-60"] : [],
      })),
    ],
    [visible, birthdayEvents, now],
  );

  const inRange = visible.filter((event) => {
    const start = new Date(event.startsAt).getTime();
    return start >= range.start && start < range.end;
  }).length;

  const mediaEvents = React.useMemo(() => events.filter((event) => event.category === "media"), [events]);
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

      {(upcomingBirthdays.today.length > 0 || upcomingBirthdays.tomorrow.length > 0) && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-pink-500/30 bg-pink-500/5 px-4 py-3 text-sm">
          {upcomingBirthdays.today.length > 0 && (
            <p className="flex items-start gap-2">
              <Cake className="mt-0.5 size-4 shrink-0 text-pink-500" aria-hidden="true" />
              <span>
                <b>Сегодня день рождения:</b> <BirthdayPeople people={upcomingBirthdays.today} />
              </span>
            </p>
          )}
          {upcomingBirthdays.tomorrow.length > 0 && (
            <p className="flex items-start gap-2 text-muted-foreground">
              <Cake className="mt-0.5 size-4 shrink-0 text-pink-500/70" aria-hidden="true" />
              <span>
                Завтра день рождения: <BirthdayPeople people={upcomingBirthdays.tomorrow} />
              </span>
            </p>
          )}
        </div>
      )}

      <TrackingSwitch initialEnabled={tracking} />

      {me.canMedia && (
        <ButtonGroup aria-label="Какой календарь показывать">
          <Button
            variant={activeMode === "general" ? "default" : "outline"}
            aria-pressed={activeMode === "general"}
            onClick={() => setMode("general")}
          >
            Общий
          </Button>
          <Button
            variant={activeMode === "media" ? "default" : "outline"}
            aria-pressed={activeMode === "media"}
            onClick={() => setMode("media")}
          >
            <Radio data-icon="inline-start" />
            Медиа
          </Button>
        </ButtonGroup>
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
            <Button onClick={() => setEditor({ mode: "create", category: activeMode })}>
              <Plus />
              {activeMode === "media" ? "Запланировать" : "Зарегистрировать"}
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
          eventClick={(info) => {
            // День рождения — не мероприятие: подробностей и правки у него нет
            if (!info.event.id.startsWith(BIRTHDAY_ID)) setOpenId(info.event.id);
          }}
          dateClick={(info) => {
            // Клик по дню: регистрация с подставленной датой. Для всего дня берём 12:00 по Москве.
            const iso = info.allDay ? `${info.dateStr.slice(0, 10)}T12:00:00+03:00` : info.date.toISOString();
            setEditor({ mode: "create", startsAt: new Date(iso).toISOString(), category: activeMode });
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

      {activeMode === "media" ? (
        <MediaPanel
          events={mediaEvents}
          now={now}
          entries={mediaEntries}
          entriesProblem={mediaProblem}
          onOpen={(event) => setOpenId(event.id)}
          onCreate={() => setEditor({ mode: "create", category: "media" })}
        />
      ) : (
        <EventList
          events={visible}
          now={now}
          meId={me.id}
          onOpen={(event) => setOpenId(event.id)}
          onNotifyChanged={onNotifyChanged}
        />
      )}

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
        canMedia={me.canMedia}
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
