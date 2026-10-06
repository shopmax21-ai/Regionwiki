"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { Ban, CheckCircle2, Search, ShieldCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { AccessAvatar } from "./access-avatar";
import { DecisionButtons } from "./decision-buttons";

export type MemberRow = {
  telegramId: string;
  name: string;
  username: string | null;
  status: "pending" | "approved" | "rejected";
  admin: boolean;
  /** Уже отформатированная дата последнего входа: форматирование на сервере, чтобы не расходилось с браузером */
  lastLogin: string;
  loginCount: number;
};

type Filter = "all" | "approved" | "rejected" | "admins";

const FILTERS: { key: Filter; label: string; icon: typeof Users }[] = [
  { key: "all", label: "Все", icon: Users },
  { key: "approved", label: "Одобрены", icon: CheckCircle2 },
  { key: "rejected", label: "Отклонены", icon: Ban },
  { key: "admins", label: "Администрация", icon: ShieldCheck },
];

const matches = (row: MemberRow, filter: Filter) =>
  filter === "all" ||
  (filter === "admins" ? row.admin : filter === "approved" ? row.status === "approved" : row.status === "rejected");

/** Все участники: поиск по имени и @username, фильтр по статусу, смена решения одной кнопкой. */
export function MembersList({ rows }: { rows: MemberRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map(({ key }) => [key, rows.filter((row) => matches(row, key)).length])),
    [rows],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/^@/, "");
    return rows.filter(
      (row) => matches(row, filter) && `${row.name} ${row.username ?? ""}`.toLowerCase().includes(needle),
    );
  }, [rows, query, filter]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-lg">Все участники</h2>
        <p className="text-muted-foreground text-sm">Статус, последний вход и число входов. Решение можно изменить.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени или @username"
            className="pl-9"
            aria-label="Поиск участников"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по статусу">
          {FILTERS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50",
                filter === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
              <span className="tabular-nums opacity-70">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
          {rows.length === 0 ? "Пока никого нет." : "Никого не нашли. Попробуйте другой запрос или фильтр."}
        </div>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {visible.map((row) => (
              <li
                key={row.telegramId}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <AccessAvatar id={row.telegramId} name={row.name} admin={row.admin} />
                  <div className="min-w-0 leading-tight">
                    <p className="flex items-center gap-1.5 font-medium text-sm">
                      <span className="truncate">{row.name}</span>
                      {row.admin && <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-label="Администратор" />}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                      {row.username ? `@${row.username}` : "Без username"}
                    </p>
                  </div>
                </div>

                <div className="hidden text-right text-muted-foreground text-xs leading-tight md:block">
                  <p>{row.lastLogin}</p>
                  <p>Входов: {row.loginCount}</p>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1.5",
                    row.status === "approved"
                      ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                      : "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", row.status === "approved" ? "bg-green-500" : "bg-destructive")}
                  />
                  {row.status === "approved" ? "Одобрен" : "Отклонён"}
                </Badge>

                <div className="flex w-[8.5rem] justify-end">
                  {row.admin ? null : (
                    <DecisionButtons
                      telegramId={row.telegramId}
                      only={row.status === "approved" ? "rejected" : "approved"}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
