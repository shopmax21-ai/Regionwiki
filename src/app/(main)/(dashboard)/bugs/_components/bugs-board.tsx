"use client";

import { useState, useTransition } from "react";

import Link from "next/link";

import { cn } from "cn";
import { Bug, CircleCheck, ExternalLink, Hammer, LoaderCircle, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { PersonName } from "@/components/person-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/academy/format";
import { BUG_STATUS_LABELS, BUG_STATUSES, type BugCounts, type BugReport, type BugStatus } from "@/lib/bugs/types";

import { setBugStatusAction } from "../_actions";

function StatusBadge({ status }: { status: BugStatus }) {
  if (status === "done") {
    return (
      <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400">
        <CircleCheck /> {BUG_STATUS_LABELS.done}
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
        <Hammer /> {BUG_STATUS_LABELS.in_progress}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <Bug /> {BUG_STATUS_LABELS.new}
    </Badge>
  );
}

function Actions({ bug }: { bug: BugReport }) {
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<BugStatus | null>(null);

  const change = (status: BugStatus) => {
    setTarget(status);
    startTransition(async () => {
      try {
        const result = await setBugStatusAction(bug.id, status);
        if (!result.ok) toast.error(result.error);
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  const icon = (status: BugStatus, fallback: React.ReactNode) =>
    pending && target === status ? <LoaderCircle className="animate-spin" /> : fallback;

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {bug.status === "new" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => change("in_progress")}>
          {icon("in_progress", <Hammer />)} Взять в работу
        </Button>
      )}
      {bug.status !== "done" && (
        <Button size="sm" disabled={pending} onClick={() => change("done")}>
          {icon("done", <CircleCheck />)} Выполнено
        </Button>
      )}
      {bug.status !== "new" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("new")}>
          {icon("new", <Undo2 />)} {bug.status === "done" ? "Вернуть в очередь" : "Снять с работы"}
        </Button>
      )}
    </div>
  );
}

/** Список баг-репортов со вкладками по статусу. Кнопки обработки видят только те, у кого есть право. */
export function BugsBoard({
  bugs,
  counts,
  current,
  canManage,
}: {
  bugs: BugReport[];
  counts: BugCounts;
  current: BugStatus | undefined;
  canManage: boolean;
}) {
  const total = counts.new + counts.in_progress + counts.done;
  const tabs: { key: BugStatus | undefined; label: string; count: number }[] = [
    { key: undefined, label: "Все", count: total },
    ...BUG_STATUSES.map((status) => ({ key: status, label: BUG_STATUS_LABELS[status], count: counts[status] })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl tracking-tight">Баг-репорты</h1>
        <p className="text-muted-foreground text-sm">
          Сообщения участников об ошибках на сайте.{" "}
          {canManage
            ? "Возьмите репорт в работу, чтобы остальные видели, что им занимаются, и отметьте выполненным, когда ошибка исправлена."
            : "Менять статусы могут только администраторы с правом обработки."}
        </p>
      </div>

      <nav aria-label="Статус баг-репортов" className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <Link
              key={tab.key ?? "all"}
              href={tab.key ? `/bugs?status=${tab.key}` : "/bugs"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {tab.label}
              <span className={cn("text-xs tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>
                {tab.count}
              </span>
            </Link>
          );
        })}
      </nav>

      {bugs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground text-sm">
          {total === 0 ? "Баг-репортов пока нет." : "В этом статусе баг-репортов нет."}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {bugs.map((bug) => (
            <li key={bug.id}>
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words font-medium text-sm leading-snug">{bug.title}</h2>
                        <StatusBadge status={bug.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                        <PersonName person={bug.reporter} avatar />
                        <time dateTime={bug.createdAt}>{formatDateTime(bug.createdAt)} (МСК)</time>
                        <Link
                          href={bug.pagePath}
                          className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
                        >
                          <ExternalLink className="size-3" /> {bug.pagePath}
                        </Link>
                      </div>
                    </div>
                    {canManage && <Actions bug={bug} />}
                  </div>

                  <p className="whitespace-pre-line break-words text-sm">{bug.description}</p>

                  {(bug.assignee || bug.doneBy) && (
                    <div className="flex flex-col gap-1 border-t pt-3 text-muted-foreground text-xs">
                      {bug.assignee && (
                        <span className="flex flex-wrap items-center gap-x-1.5">
                          Взял в работу: <PersonName person={bug.assignee} />
                          {bug.takenAt && <time dateTime={bug.takenAt}>· {formatDateTime(bug.takenAt)} (МСК)</time>}
                        </span>
                      )}
                      {bug.doneBy && (
                        <span className="flex flex-wrap items-center gap-x-1.5">
                          Выполнено: <PersonName person={bug.doneBy} />
                          {bug.doneAt && <time dateTime={bug.doneAt}>· {formatDateTime(bug.doneAt)} (МСК)</time>}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
