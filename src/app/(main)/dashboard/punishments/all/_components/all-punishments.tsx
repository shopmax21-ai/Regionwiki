"use client";

import { type ReactNode, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ExternalLink, Paperclip, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildCommand, EVENT_LABELS, type PunishmentEvent, type PunishmentRequest } from "@/lib/punishments/types";

import { releaseRequestAction } from "../../_actions";
import { formatFull, formatShort, minutesText } from "../../_components/format";
import { AdminStatusBadge, RuleChips } from "../../_components/status-badge";

/** Подходит ли строка под поисковый запрос: ищем вхождение в любом из полей без учёта регистра. */
const matchesQuery = (needle: string, parts: (string | number | null)[]) =>
  needle === "" ||
  parts.some((part) =>
    String(part ?? "")
      .toLowerCase()
      .includes(needle),
  );

type Tab = "all" | "review" | "issued" | "rejected" | "history";

const inReview = (request: PunishmentRequest) =>
  request.status === "pending" || request.status === "claimed" || request.status === "approved";

type AllPunishmentsProps = { requests: PunishmentRequest[]; events: PunishmentEvent[] };

/**
 * Раздел Гл.Администратора: все заявки на наказание (на рассмотрении, выданные, отклонённые) и история всех действий.
 * Нажатие на строку открывает подробности: доказательства, кто взял и выдал, хронология.
 */
export function AllPunishments({ requests, events }: AllPunishmentsProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [releasing, startRelease] = useTransition();

  const counts = useMemo(
    () => ({
      all: requests.length,
      review: requests.filter(inReview).length,
      issued: requests.filter((r) => r.status === "issued").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
      history: events.length,
    }),
    [requests, events],
  );

  const needle = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      requests
        .filter((request) => {
          if (tab === "review") return inReview(request);
          if (tab === "issued" || tab === "rejected") return request.status === tab;
          return true;
        })
        .filter((request) =>
          matchesQuery(needle, [
            request.number,
            request.staticId,
            request.requesterName,
            request.assigneeName,
            request.rules.join(" "),
          ]),
        ),
    [requests, tab, needle],
  );

  const feed = useMemo(
    () =>
      events.filter((event) =>
        matchesQuery(needle, [event.number, event.staticId, event.actorName, EVENT_LABELS[event.type], event.note]),
      ),
    [events, needle],
  );

  const opened = requests.find((request) => request.id === openId) ?? null;
  const openedEvents = useMemo(
    () => events.filter((event) => event.requestId === openId).sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id),
    [events, openId],
  );

  const release = (request: PunishmentRequest) =>
    startRelease(async () => {
      const result = await releaseRequestAction(request.id).catch(() => ({
        ok: false as const,
        error: "Нет связи с сервером",
      }));
      if (!result.ok) toast.error(result.error);
      else toast.success(`Заявка №${request.number} возвращена в очередь`);
      router.refresh();
    });

  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "review", label: "На рассмотрении" },
    { value: "issued", label: "Выданные" },
    { value: "rejected", label: "Отклонённые" },
    { value: "history", label: "История" },
  ];

  let body: ReactNode;
  if (tab === "history" && feed.length === 0) {
    body = <p className="px-4 py-8 text-center text-muted-foreground text-sm">Записей нет.</p>;
  } else if (tab === "history") {
    body = (
      <div className="overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Время</TableHead>
              <TableHead>Действие</TableHead>
              <TableHead>Заявка</TableHead>
              <TableHead>Кто</TableHead>
              <TableHead className="pr-4">Комментарий</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feed.map((event) => (
              <TableRow key={event.id} className="cursor-pointer" onClick={() => setOpenId(event.requestId)}>
                <TableCell className="whitespace-nowrap pl-4 text-muted-foreground text-xs tabular-nums">
                  {formatFull(event.at)}
                </TableCell>
                <TableCell className="font-medium">{EVENT_LABELS[event.type]}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  №{event.number} · {event.staticId}
                </TableCell>
                <TableCell className="max-w-40 truncate">{event.actorName}</TableCell>
                <TableCell className="max-w-64 truncate pr-4 text-muted-foreground text-xs">
                  {event.note || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  } else if (rows.length === 0) {
    body = <p className="px-4 py-8 text-center text-muted-foreground text-sm">Заявок по выбранным условиям нет.</p>;
  } else {
    body = (
      <div className="overflow-x-auto">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">№</TableHead>
              <TableHead>Статик</TableHead>
              <TableHead>Время</TableHead>
              <TableHead>Пункты</TableHead>
              <TableHead>Хелпер</TableHead>
              <TableHead>Администратор</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="pr-4">Дата</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((request) => (
              <TableRow key={request.id} className="cursor-pointer" onClick={() => setOpenId(request.id)}>
                <TableCell className="pl-4 text-muted-foreground tabular-nums">{request.number}</TableCell>
                <TableCell className="font-medium tabular-nums">
                  {request.staticId}
                  {request.evidence.length > 0 && (
                    <Paperclip
                      className="ml-1.5 inline size-3 text-muted-foreground"
                      aria-label="Есть доказательства"
                    />
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{minutesText(request.minutes)}</TableCell>
                <TableCell>
                  <RuleChips rules={request.rules} />
                </TableCell>
                <TableCell className="max-w-36 truncate">{request.requesterName}</TableCell>
                <TableCell className="max-w-36 truncate">{request.assigneeName ?? "—"}</TableCell>
                <TableCell>
                  <AdminStatusBadge status={request.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap pr-4 text-muted-foreground text-xs tabular-nums">
                  {formatShort(request.issuedAt ?? request.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList className="h-auto flex-wrap">
            {tabs.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label} <span className="ml-1 text-muted-foreground tabular-nums">{counts[item.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Статик, имя, номер, пункт"
            aria-label="Поиск по наказаниям"
            className="pl-8"
          />
        </div>
      </div>

      <Card className="gap-0 py-0">{body}</Card>

      <Dialog open={opened !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        {opened && (
          <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Заявка №{opened.number} <AdminStatusBadge status={opened.status} />
              </DialogTitle>
              <DialogDescription>
                Подана {formatFull(opened.createdAt)} · хелпер {opened.requesterName}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid gap-3 sm:grid-cols-2">
              <Fact label="Статик" value={opened.staticId} />
              <Fact label="Время наказания" value={minutesText(opened.minutes)} />
              <Fact label="Администратор" value={opened.assigneeName ?? "Пока никто не взял"} />
              <Fact label="Выдано" value={opened.issuedAt ? formatFull(opened.issuedAt) : "—"} />
            </dl>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs">Пункты правил</p>
              <RuleChips rules={opened.rules} />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs">Команда</p>
              <code className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-sm">{buildCommand(opened)}</code>
            </div>
            {opened.status === "rejected" && (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                Причина отклонения: {opened.decisionNote || "не указана"}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <p className="font-medium text-sm">Доказательства</p>
              {opened.evidence.length === 0 ? (
                <p className="text-muted-foreground text-xs">Не приложены.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {opened.evidence.map((item) => (
                    <li key={item.url}>
                      {item.type === "image" ? (
                        <a href={item.url} target="_blank" rel="noreferrer" aria-label="Открыть скриншот">
                          {/* biome-ignore lint/performance/noImgElement: превью загруженного скриншота */}
                          <img src={item.url} alt="Скриншот" className="h-20 w-32 rounded-lg border object-cover" />
                        </a>
                      ) : (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex max-w-72 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted"
                        >
                          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.url.replace(/^https:\/\//, "")}</span>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-medium text-sm">История</p>
              <ol className="flex flex-col gap-1.5 border-l pl-4">
                {openedEvents.map((event) => (
                  <li key={event.id} className="text-sm">
                    <span className="font-medium">{EVENT_LABELS[event.type]}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {event.actorName} · {formatFull(event.at)}
                    </span>
                    {event.note && <span className="block text-muted-foreground text-xs">{event.note}</span>}
                  </li>
                ))}
              </ol>
            </div>

            {(opened.status === "claimed" || opened.status === "approved") && (
              <div>
                <Button variant="outline" size="sm" onClick={() => release(opened)} disabled={releasing}>
                  <Undo2 data-icon="inline-start" />
                  {releasing ? "Возвращаем..." : "Вернуть в очередь"}
                </Button>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  Например, если администратор не может её рассмотреть.
                </p>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate font-medium text-sm">{value}</dd>
    </div>
  );
}
