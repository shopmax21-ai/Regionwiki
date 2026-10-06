import { Bell, BellOff, MapPin } from "lucide-react";

import { PersonName } from "@/components/person-name";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRange, relativeTo } from "@/lib/calendar/format";
import { type CalendarEvent, type EventStatus, STATUS_LABELS, statusOf } from "@/lib/calendar/types";

import { NotifySwitch } from "./notify-switch";
import { StatusBadge } from "./status-badge";

type EventListProps = {
  events: CalendarEvent[];
  now: number;
  meId: string;
  onOpen: (event: CalendarEvent) => void;
  onNotifyChanged: (id: string, notify: boolean) => void;
};

const ORDER: EventStatus[] = ["live", "upcoming", "finished"];
/** Закончившиеся показываем недолго: полная история есть в календаре */
const FINISHED_LIMIT = 8;

/** Список под календарём: идёт сейчас, ожидается, недавно закончилось. Ползунок напоминания есть у своих мероприятий. */
export function EventList({ events, now, meId, onOpen, onNotifyChanged }: EventListProps) {
  const groups = ORDER.map((status) => {
    const items = events.filter((event) => statusOf(event, now) === status);
    // Ближайшие вперёд, закончившиеся: самые свежие первыми
    items.sort((a, b) =>
      status === "finished" ? b.endsAt.localeCompare(a.endsAt) : a.startsAt.localeCompare(b.startsAt),
    );
    return { status, items: status === "finished" ? items.slice(0, FINISHED_LIMIT) : items };
  }).filter((group) => group.items.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Мероприятия</CardTitle>
        <CardDescription>Нажмите на мероприятие, чтобы увидеть подробности. Время московское.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {groups.length === 0 && (
          <p className="py-6 text-center text-muted-foreground text-sm">
            Мероприятий пока нет. Зарегистрируйте первое кнопкой выше.
          </p>
        )}
        {groups.map((group) => (
          <section key={group.status} className="flex flex-col gap-2" aria-label={STATUS_LABELS[group.status]}>
            <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {STATUS_LABELS[group.status]} · {group.items.length}
            </h3>
            <ul className="flex flex-col divide-y rounded-xl border">
              {group.items.map((event) => {
                const mine = event.ownerId === meId;
                const upcoming = group.status === "upcoming";
                return (
                  <li key={event.id} className="flex items-center gap-3 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOpen(event)}
                      className="flex min-w-0 flex-1 flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-sm">{event.title}</span>
                        <StatusBadge status={group.status} />
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
                        <span>{formatRange(event.startsAt, event.endsAt)}</span>
                        <span className="flex min-w-0 items-center gap-1">
                          <PersonName person={event.owner} />
                          {mine ? " (вы)" : ""}
                        </span>
                        {event.location && (
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPin className="size-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{event.location}</span>
                          </span>
                        )}
                        {upcoming && <span>{relativeTo(event.startsAt, now)}</span>}
                      </span>
                    </button>
                    {upcoming &&
                      (mine ? (
                        <span
                          className="flex shrink-0 items-center gap-2"
                          title="Напоминание в Telegram за час до начала"
                        >
                          <Bell className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          <NotifySwitch event={event} onChanged={onNotifyChanged} compact />
                        </span>
                      ) : (
                        <span
                          className="shrink-0 text-muted-foreground"
                          title={event.notify ? "У автора включено напоминание" : "У автора напоминание выключено"}
                        >
                          {event.notify ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
                        </span>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
