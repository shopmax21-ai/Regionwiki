"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { Ban, CheckCircle2, Search, ShieldCheck, Users } from "lucide-react";

import { PersonName } from "@/components/person-name";
import { StatusIcon } from "@/components/status-icon";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROW_BANNER_CLASS, rowBannerStyle } from "@/lib/row-banner";

import { AccessAvatar } from "./access-avatar";
import { DecisionButtons } from "./decision-buttons";

export type MemberRow = {
  telegramId: string;
  name: string;
  username: string | null;
  nickname: string | null;
  staticId: string | null;
  status: "pending" | "approved" | "rejected";
  admin: boolean;
  /** Уже отформатированная дата последнего входа: форматирование на сервере, чтобы не расходилось с браузером */
  lastLogin: string;
  /** Баннер профиля: адрес картинки или null */
  background: string | null;
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
      (row) => matches(row, filter) && `${row.name} ${row.nickname ?? ""} ${row.staticId ?? ""} ${row.username ?? ""}`.toLowerCase().includes(needle),
    );
  }, [rows, query, filter]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-lg">Все участники</h2>
        <p className="text-muted-foreground text-sm">Статус и последний вход. Решение можно изменить.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени или @username"
            className="pl-9"
            aria-label="Поиск участников" data-section-search
          />
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: фильтр-кнопки: role="group" на div, fieldset сломает вёрстку */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по статусу">
          {FILTERS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50",
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
        <Card className="gap-0 overflow-hidden py-0">
          <div
            aria-hidden="true"
            className="hidden border-b bg-muted/40 px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide md:grid md:grid-cols-[minmax(0,1fr)_11rem_4rem_9.5rem] md:items-center md:gap-x-4"
          >
            <span>Участник</span>
            <span>Последний вход</span>
            <span className="text-center">Статус</span>
            <span className="text-right">Решение</span>
          </div>
          <ul className="divide-y">
            {visible.map((row) => (
              <li
                key={row.telegramId}
                style={rowBannerStyle(row.background)}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 transition-colors hover:bg-muted/40 md:grid md:grid-cols-[minmax(0,1fr)_11rem_4rem_9.5rem] md:items-center md:gap-x-4",
                  row.background && `${ROW_BANNER_CLASS} hover:[--row-bg:color-mix(in_oklab,var(--card),var(--muted)_40%)]`,
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
                  <AccessAvatar id={row.telegramId} name={row.name} admin={row.admin} />
                  <div className="min-w-0 leading-tight">
                    <p className="flex items-center gap-1.5 font-medium text-sm">
                      <PersonName
                        person={{
                          id: row.telegramId,
                          name: row.name,
                          nickname: row.nickname,
                          staticId: row.staticId,
                          group: null,
                        }}
                        showRole={false}
                      />
                      {row.admin && (
                        <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-label="Администратор" />
                      )}
                    </p>
                  </div>
                </div>

                <p className="hidden truncate text-muted-foreground text-sm md:block">{row.lastLogin}</p>

                <div className="flex justify-center">
                  {row.status === "approved" ? (
                    <StatusIcon icon={CheckCircle2} label="Одобрен" tone="green" />
                  ) : (
                    <StatusIcon icon={Ban} label="Отклонён" tone="red" />
                  )}
                </div>

                <div className="flex justify-end">
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
