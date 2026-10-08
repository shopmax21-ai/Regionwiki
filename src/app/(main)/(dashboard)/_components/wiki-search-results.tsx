"use client";

import Link from "next/link";

import { cn } from "cn";
import { ArrowRight, SearchX } from "lucide-react";

import { SearchExternalIcon, SearchHighlight, searchKindIcons } from "@/components/search/search-ui";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchGroup, SearchHit, SearchKind } from "@/lib/search/types";

export type KindFilter = SearchKind | "all";

function plural(n: number, forms: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let form = forms[2];
  if (mod10 === 1 && mod100 !== 11) form = forms[0];
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = forms[1];
  return `${n} ${form}`;
}

export const pluralResults = (n: number) => plural(n, ["результат", "результата", "результатов"]);

function HitRow({ hit, query }: { hit: SearchHit; query: string }) {
  const Icon = searchKindIcons[hit.kind];
  const className =
    "group flex items-start gap-4 bg-card px-4 py-3.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:px-5";

  const content = (
    <>
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-focus-visible:bg-primary group-focus-visible:text-primary-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 font-medium text-sm leading-5">
          <SearchHighlight text={hit.title} query={query} />
        </span>
        {hit.subtitle && (
          <span className="mt-0.5 block truncate text-muted-foreground text-xs">
            <SearchHighlight text={hit.subtitle} query={query} />
          </span>
        )}
        {hit.snippet && (
          <span className="mt-1.5 line-clamp-2 block text-muted-foreground text-xs leading-5">
            <SearchHighlight text={hit.snippet} query={query} />
          </span>
        )}
      </span>
      {hit.external ? (
        <SearchExternalIcon className="mt-2 size-4 shrink-0 text-muted-foreground" />
      ) : (
        <ArrowRight className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
      )}
    </>
  );

  return hit.external ? (
    <a href={hit.href} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <Link href={hit.href} prefetch={false} className={className}>
      {content}
    </Link>
  );
}

export function SearchKindTabs({
  groups,
  total,
  value,
  onChange,
}: {
  groups: SearchGroup[];
  total: number;
  value: KindFilter;
  onChange: (value: KindFilter) => void;
}) {
  const tabs: { id: KindFilter; label: string; count: number }[] = [
    { id: "all", label: "Все", count: total },
    ...groups.map((group) => ({ id: group.kind as KindFilter, label: group.label, count: group.total })),
  ];

  return (
    <div role="tablist" aria-label="Фильтр результатов" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:border-primary/60 hover:text-primary",
            )}
          >
            {tab.label}
            <span
              className={cn("text-xs tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground")}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SearchResultGroups({
  groups,
  query,
  filter,
}: {
  groups: SearchGroup[];
  query: string;
  filter: KindFilter;
}) {
  const visible = filter === "all" ? groups : groups.filter((group) => group.kind === filter);

  return (
    <div className="flex flex-col gap-5">
      {visible.map((group) => {
        const Icon = searchKindIcons[group.kind];
        return (
          <section key={group.kind} aria-label={group.label} className="flex flex-col gap-2.5">
            <h3 className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
              <Icon className="size-4" />
              {group.label}
              <span className="text-xs tabular-nums">{group.total}</span>
            </h3>
            <div className="grid gap-px overflow-hidden rounded-2xl border bg-border">
              {group.hits.map((hit) => (
                <HitRow key={hit.id} hit={hit} query={query} />
              ))}
            </div>
            {filter === "all" && group.total > group.hits.length && (
              <p className="px-1 text-muted-foreground text-xs">
                Показано {group.hits.length} из {group.total}. Откройте вкладку «{group.label}», чтобы увидеть больше.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border bg-border" aria-hidden="true">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-start gap-4 bg-card px-5 py-4">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchEmpty({
  query,
  suggestions,
  onPick,
}: {
  query: string;
  suggestions: string[];
  onPick: (word: string) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card px-6 py-12 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </span>
      <p className="mt-4 font-medium">По запросу «{query}» ничего нет</p>
      <p className="mt-1 text-muted-foreground text-sm">Проверьте написание или попробуйте одно из этих слов.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {suggestions.map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => onPick(word)}
            className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:border-primary/60 hover:text-primary"
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}
