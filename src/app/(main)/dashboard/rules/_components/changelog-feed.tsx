"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import { ArrowUpRight, ChevronDown, type LucideIcon, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { type DiffPart, diffWords } from "./diff-words";
import {
  articleHref,
  type ChangelogEntry,
  formatRuleRef,
  type RuleChange,
  type RuleChangeType,
  ruleGroups,
} from "./rules-meta";

type Filter = "all" | RuleChangeType;

const typeMeta: Record<RuleChangeType, { label: string; icon: LucideIcon; badgeClass: string }> = {
  added: {
    label: "Добавлено",
    icon: Plus,
    badgeClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  changed: {
    label: "Изменено",
    icon: Pencil,
    badgeClass: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  removed: {
    label: "Удалено",
    icon: Trash2,
    badgeClass: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  },
};

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "added", label: typeMeta.added.label },
  { id: "changed", label: typeMeta.changed.label },
  { id: "removed", label: typeMeta.removed.label },
];

function DiffText({ parts, tone }: { parts: DiffPart[]; tone: "before" | "after" }) {
  return (
    <p className="text-sm leading-relaxed break-words whitespace-pre-line">
      {parts.map((part, index) => {
        const key = `${index}-${part.text}`;
        if (!part.changed) return <span key={key}>{part.text}</span>;
        return tone === "before" ? (
          <del key={key} className="rounded-sm bg-red-500/20 px-0.5 text-foreground decoration-red-500/70">
            {part.text}
          </del>
        ) : (
          <ins key={key} className="rounded-sm bg-emerald-500/20 px-0.5 text-foreground no-underline">
            {part.text}
          </ins>
        );
      })}
    </p>
  );
}

function Side({ label, tone, children }: { label: string; tone: "before" | "after"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border p-3",
        tone === "before" ? "border-red-500/20 bg-red-500/5" : "border-emerald-500/20 bg-emerald-500/5",
      )}
    >
      <span
        className={cn(
          "text-xs font-semibold tracking-wide uppercase",
          tone === "before" ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300",
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function ChangeBody({ change }: { change: RuleChange }) {
  if (change.type === "changed" && change.before !== undefined && change.after !== undefined) {
    const diff = diffWords(change.before, change.after);
    return (
      <div className="grid min-w-0 gap-2 md:grid-cols-2">
        <Side label="Было" tone="before">
          <DiffText parts={diff.before} tone="before" />
        </Side>
        <Side label="Стало" tone="after">
          <DiffText parts={diff.after} tone="after" />
        </Side>
      </div>
    );
  }

  if (change.type === "removed") {
    return (
      <Side label="Было" tone="before">
        <p className="text-sm leading-relaxed break-words whitespace-pre-line">{change.before}</p>
      </Side>
    );
  }

  return (
    <Side label="Стало" tone="after">
      <p className="text-sm leading-relaxed break-words whitespace-pre-line">{change.after}</p>
    </Side>
  );
}

function ChangeItem({ change, entry }: { change: RuleChange; entry: ChangelogEntry }) {
  const meta = typeMeta[change.type];
  const Icon = meta.icon;
  const tag = ruleGroups[entry.group].articles.find((article) => article.slug === entry.slug)?.tag;
  const anchor = `rule-${change.number.replace(/\./g, "-")}`;

  return (
    <li className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={meta.badgeClass}>
          <Icon data-icon="inline-start" /> {meta.label}
        </Badge>
        {change.type === "removed" ? (
          <span className="text-sm font-semibold">{formatRuleRef(tag, change.number)}</span>
        ) : (
          <Link
            href={`${articleHref(entry.group, entry.slug)}#${anchor}`}
            className="inline-flex items-center gap-1 rounded-md text-sm font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {formatRuleRef(tag, change.number)}
            <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}
      </div>
      <ChangeBody change={change} />
    </li>
  );
}

export function ChangelogFeed({ entries }: { entries: ChangelogEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: 0, added: 0, changed: 0, removed: 0 };
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        result.all += 1;
        result[change.type] += 1;
      }
    }
    return result;
  }, [entries]);

  const days = useMemo(() => {
    const groups = new Map<string, { entry: ChangelogEntry; changes: RuleChange[] }[]>();

    for (const entry of entries) {
      const changes = (entry.changes ?? []).filter((change) => filter === "all" || change.type === filter);
      if (filter !== "all" && changes.length === 0) continue;
      groups.set(entry.date, [...(groups.get(entry.date) ?? []), { entry, changes }]);
    }
    return [...groups.entries()];
  }, [entries, filter]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="m-0 flex min-w-0 gap-2 overflow-x-auto border-0 p-0 pb-1">
        <legend className="sr-only">Тип изменений</legend>
        {filters.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={filter === item.id ? "default" : "outline"}
            aria-pressed={filter === item.id}
            className="shrink-0"
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            {item.id !== "all" || counts.all > 0 ? (
              <span className="tabular-nums opacity-70">{counts[item.id]}</span>
            ) : null}
          </Button>
        ))}
      </fieldset>

      {days.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Изменений выбранного типа нет.
        </div>
      ) : (
        <ol className="flex min-w-0 flex-col gap-8 border-l pl-6">
          {days.map(([date, items], dayIndex) => {
            const total = items.reduce((sum, item) => sum + item.changes.length, 0);
            return (
              <li key={date} className="relative min-w-0">
                <span
                  className="absolute top-2 left-[calc(-1.5rem-6.5px)] size-3 rounded-full border-2 border-background bg-primary"
                  aria-hidden="true"
                />
                <Collapsible defaultOpen={dayIndex === 0} className="flex min-w-0 flex-col gap-3">
                  <CollapsibleTrigger className="group flex min-w-0 w-full items-center justify-between gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="text-xl font-semibold tracking-tight">{date}</h2>
                      {total > 0 && <span className="text-sm text-muted-foreground">изменений: {total}</span>}
                    </span>
                    <ChevronDown
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                      aria-hidden="true"
                    />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="flex min-w-0 flex-col gap-3">
                    {items.map(({ entry, changes }, entryIndex) => (
                      <Card key={`${entry.date}-${entry.slug}-${entryIndex}`} className="min-w-0">
                        <CardHeader className="min-w-0">
                          <CardTitle className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                            <Link
                              href={articleHref(entry.group, entry.slug)}
                              className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              {entry.title}
                              <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
                            </Link>
                            <Badge variant="outline" className="font-normal">
                              {entry.section}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="min-w-0">
                          {changes.length > 0 ? (
                            <ul className="flex min-w-0 flex-col gap-5">
                              {changes.map((change, changeIndex) => (
                                <ChangeItem
                                  key={`${change.type}-${change.number}-${changeIndex}`}
                                  change={change}
                                  entry={entry}
                                />
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">Подробности изменений не указаны.</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
