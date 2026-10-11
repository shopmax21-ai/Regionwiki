"use client";

import Link from "next/link";

import { Bell, BellOff, CalendarPlus, ExternalLink, Radio, RefreshCw } from "lucide-react";

import { formatUptime, formatViewers } from "@/app/(main)/(dashboard)/media/_components/format";
import { useMediaStreams } from "@/app/(main)/(dashboard)/media/_components/use-media-streams";
import { PersonName } from "@/components/person-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRange, relativeTo } from "@/lib/calendar/format";
import { type CalendarEvent, MSK_ZONE, statusOf } from "@/lib/calendar/types";
import { channelKey, platformLabels } from "@/lib/media/types";
import { type MediaPrEntry, mediaPrPlatformLabels, mediaPrStatusLabels } from "@/lib/mediapr/types";

import { StatusBadge } from "./status-badge";

const timeOnly = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: MSK_ZONE });
const dayLabel = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "long",
  timeZone: MSK_ZONE,
});
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: MSK_ZONE });
const number = new Intl.NumberFormat("ru-RU");

type MediaPanelProps = {
  /** Только медиа-мероприятия */
  events: CalendarEvent[];
  now: number;
  /** Таблица медиа (null, если у администратора нет доступа к «Медиа PR») */
  entries: MediaPrEntry[] | null;
  /** Почему таблица не загрузилась */
  entriesProblem: string | null;
  onOpen: (event: CalendarEvent) => void;
  onCreate: () => void;
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="hud-corners flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
      <span className="hud-label text-muted-foreground">{label}</span>
      <span className="font-heading text-xl tabular-nums">{value}</span>
      {hint && <span className="truncate text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

/** Вкладка «Медиа» в календаре: расписание стримов, кто в эфире сейчас, отслеживаемые каналы и таблица медиа. */
export function MediaPanel({ events, now, entries, entriesProblem, onOpen, onCreate }: MediaPanelProps) {
  const { data, failed, refreshing, reload } = useMediaStreams();

  const live = events.filter((event) => statusOf(event, now) === "live");
  const upcoming = events
    .filter((event) => statusOf(event, now) === "upcoming")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const finished = events
    .filter((event) => statusOf(event, now) === "finished")
    .sort((a, b) => b.endsAt.localeCompare(a.endsAt))
    .slice(0, 5);
  const schedule = [...live, ...upcoming];

  // Расписание по дням: «вт, 13 октября»
  const days: { key: string; label: string; items: CalendarEvent[] }[] = [];
  for (const event of schedule) {
    const key = dayKey.format(new Date(event.startsAt));
    const last = days.at(-1);
    if (last?.key === key) last.items.push(event);
    else days.push({ key, label: dayLabel.format(new Date(event.startsAt)), items: [event] });
  }

  const tracked = data?.streams.filter((stream) => stream.tracked) ?? [];
  const liveKeys = new Set(tracked.map((stream) => channelKey(stream)));
  const next = upcoming[0];
  const activeEntries = entries?.filter((entry) => entry.status === "active").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="В эфире сейчас"
          value={data ? String(tracked.length) : "..."}
          hint={failed ? "Не удалось проверить" : "Отслеживаемые каналы"}
        />
        <Stat
          label="Ближайший стрим"
          value={next ? relativeTo(next.startsAt, now) : "Нет"}
          hint={next ? next.title : "Ничего не запланировано"}
        />
        <Stat label="В расписании" value={String(schedule.length)} hint="Идут и ожидаются" />
        <Stat
          label="Медиа-партнёры"
          value={entries ? String(entries.length) : "—"}
          hint={entries ? `Сотрудничаем: ${activeEntries}` : "Нет доступа к таблице"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Расписание стримов</CardTitle>
          <CardDescription>Медиа-события из календаря. Время московское.</CardDescription>
          <CardAction>
            <Button onClick={onCreate}>
              <CalendarPlus data-icon="inline-start" />
              Запланировать
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {days.length === 0 && (
            <p className="py-6 text-center text-muted-foreground text-sm">
              Стримов пока нет. Запланируйте первый кнопкой выше.
            </p>
          )}
          {days.map((day) => (
            <section key={day.key} className="flex flex-col gap-2" aria-label={day.label}>
              <h3 className="hud-label text-muted-foreground">{day.label}</h3>
              <ul className="flex flex-col divide-y rounded-xl border">
                {day.items.map((event) => {
                  const status = statusOf(event, now);
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(event)}
                        className="flex w-full items-center gap-4 px-3 py-2.5 text-left outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="w-24 shrink-0 font-mono text-sm tabular-nums">
                          {timeOnly.format(new Date(event.startsAt))}–{timeOnly.format(new Date(event.endsAt))}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium text-sm">{event.title}</span>
                            <StatusBadge status={status} />
                          </span>
                          <span className="flex flex-wrap items-center gap-x-3 text-muted-foreground text-xs">
                            {event.location && <span className="truncate">{event.location}</span>}
                            <span className="flex items-center gap-1">
                              <PersonName person={event.owner} />
                            </span>
                            {status === "upcoming" && <span>{relativeTo(event.startsAt, now)}</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-muted-foreground" aria-hidden="true">
                          {event.notify ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {finished.length > 0 && (
            <section className="flex flex-col gap-2" aria-label="Недавно прошли">
              <h3 className="hud-label text-muted-foreground">Недавно прошли</h3>
              <ul className="flex flex-col divide-y rounded-xl border">
                {finished.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(event)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-muted-foreground text-sm outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="truncate">{event.title}</span>
                      <span className="shrink-0 font-mono text-xs tabular-nums">
                        {formatRange(event.startsAt, event.endsAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Каналы под наблюдением</CardTitle>
          <CardDescription>
            Кто из отслеживаемых каналов в эфире прямо сейчас. Каналы добавляются в разделе «Медиа».
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="icon" onClick={() => void reload()} aria-label="Обновить эфиры">
              <RefreshCw className={refreshing ? "animate-spin" : undefined} />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {failed && !data && (
            <p role="alert" className="text-destructive text-sm">
              Не удалось получить данные об эфирах.
            </p>
          )}
          {data && data.status !== "ok" && (
            <p className="text-muted-foreground text-sm">
              {data.status === "unconfigured"
                ? "Ключи Twitch и YouTube не заданы, эфиры не проверяются."
                : (data.problem ?? "Площадки сейчас не отвечают.")}
            </p>
          )}
          {data && data.channels.length === 0 && data.status === "ok" && (
            <p className="py-4 text-center text-muted-foreground text-sm">Каналов в списке пока нет.</p>
          )}
          {data && data.channels.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.channels.map((channel) => {
                const stream = tracked.find((item) => channelKey(item) === channelKey(channel));
                const isLive = liveKeys.has(channelKey(channel));
                return (
                  <li key={channelKey(channel)} className="flex items-start gap-3 rounded-xl border px-3 py-2.5">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${isLive ? "bg-green-500" : "bg-muted-foreground/40"}`}
                      role="img"
                      aria-label={isLive ? "В эфире" : "Не в эфире"}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={stream?.url ?? channel.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 truncate font-medium text-sm hover:underline"
                        >
                          {channel.name}
                          <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </a>
                        <Badge variant="outline">{platformLabels[channel.platform]}</Badge>
                        {isLive && (
                          <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
                            <Radio data-icon="inline-start" />
                            Эфир
                          </Badge>
                        )}
                      </div>
                      {stream ? (
                        <p className="truncate text-muted-foreground text-xs">
                          {stream.title || "Без названия"} ·{" "}
                          <span className="font-mono tabular-nums">{formatViewers(stream.viewers)}</span> зрителей · с{" "}
                          {timeOnly.format(new Date(stream.startedAt))}
                          {formatUptime(stream.startedAt, data.updatedAt)
                            ? ` (${formatUptime(stream.startedAt, data.updatedAt)})`
                            : ""}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          Не в эфире · {channel.notify ? "оповещение включено" : "без оповещения"}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {entries !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Информация по медиа</CardTitle>
            <CardDescription>Таблица «Медиа PR»: площадка, аудитория, контакты и этап сотрудничества.</CardDescription>
            <CardAction>
              <Button variant="outline" asChild>
                <Link href="/media-pr">Открыть раздел</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {entriesProblem && (
              <p role="alert" className="text-destructive text-sm">
                Не удалось загрузить таблицу: {entriesProblem}
              </p>
            )}
            {!entriesProblem && entries.length === 0 && (
              <p className="py-4 text-center text-muted-foreground text-sm">В таблице пока нет записей.</p>
            )}
            {entries.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Медиа</TableHead>
                    <TableHead>Площадка</TableHead>
                    <TableHead className="text-right">Аудитория</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Контакт</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.url ? (
                          <a href={entry.url} target="_blank" rel="noreferrer" className="hover:underline">
                            {entry.name}
                          </a>
                        ) : (
                          entry.name
                        )}
                        {entry.note && (
                          <p className="max-w-64 truncate font-normal text-muted-foreground text-xs">{entry.note}</p>
                        )}
                      </TableCell>
                      <TableCell>{mediaPrPlatformLabels[entry.platform]}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {entry.audience === null ? "—" : number.format(entry.audience)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.status === "active" ? "default" : "secondary"}>
                          {mediaPrStatusLabels[entry.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entry.contact || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
