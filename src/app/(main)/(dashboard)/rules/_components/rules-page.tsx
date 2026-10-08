"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import { ArrowUpRight, Search, X } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { ChangelogFeed } from "./changelog-feed";
import { getRuleIcon } from "./rule-icons";
import { RuleStatusBlock } from "./rule-status";
import { Highlight, matchesQuery, PunishmentList } from "./rule-ui";
import {
  articleHref,
  type ChangelogEntry,
  formatRuleRef,
  type RuleArticleCard,
  type RuleGroup,
  type RuleSearchEntry,
  type RulesStatus,
  ruleGroups,
} from "./rules-meta";

const MAX_RESULTS = 60;

export function RulesPage({
  group,
  cards,
  searchIndex,
  status,
}: {
  group: RuleGroup;
  cards: RuleArticleCard[];
  searchIndex: RuleSearchEntry[];
  status: RulesStatus;
}) {
  const data = ruleGroups[group];
  const [query, setQuery] = useState("");
  const isSearching = query.trim().length > 0;
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+F (⌘F на Mac) вместо поиска браузера фокусирует поиск по правилам
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.code === "KeyF") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const articles = useMemo(
    () => cards.filter((card) => matchesQuery(`${card.title} ${card.description}`, query)),
    [cards, query],
  );

  const results = useMemo(() => {
    if (!isSearching) return [];
    return searchIndex.filter((entry) =>
      matchesQuery(
        `${entry.number} ${entry.text} ${entry.extra} ${entry.punishments.join(" ")} ${entry.articleTitle}`,
        query,
      ),
    );
  }, [isSearching, query, searchIndex]);

  return (
    <main className="flex w-full min-w-0 flex-col gap-6 pb-10">
      <section className="relative px-2 pt-12 pb-2 sm:pt-6 md:px-6 md:pt-8">
        <RuleStatusBlock
          state={status.state}
          lastChecked={status.lastChecked}
          className="absolute top-0 right-0 sm:top-1 md:top-2"
        />
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{data.title}</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">{data.description}</p>
          <div className="relative mt-7 w-full">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти пункт: например DM, 4.9, Demorgan, перекрытие"
              className="h-11 rounded-xl pl-10 pr-24"
              aria-label="Поиск по всем пунктам правил"
            />
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {isSearching ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Очистить поиск"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : (
                <kbd className="pointer-events-none hidden rounded-md border bg-muted/50 px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:inline-block">
                  Ctrl + F
                </kbd>
              )}
            </div>
          </div>
        </div>
      </section>

      {isSearching && (
        <Card>
          <CardHeader>
            <CardTitle>Найденные пункты</CardTitle>
            <CardDescription>
              {results.length > 0
                ? `Найдено: ${results.length}${results.length > MAX_RESULTS ? ` (показаны первые ${MAX_RESULTS})` : ""}`
                : "Ничего не найдено. Попробуйте другие слова или номер пункта."}
            </CardDescription>
          </CardHeader>
          {results.length > 0 && (
            <CardContent className="flex flex-col gap-2">
              {results.slice(0, MAX_RESULTS).map((entry) => (
                <Link
                  key={`${entry.slug}-${entry.anchor}`}
                  href={`${articleHref(entry.group, entry.slug)}#${entry.anchor}`}
                  className="group flex min-w-0 flex-col gap-2 rounded-xl border p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                      {formatRuleRef(entry.tag, entry.number)}
                    </span>
                    <span className="truncate">
                      {entry.articleTitle} · {entry.sectionTitle}
                    </span>
                    <ArrowUpRight className="ml-auto size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <p className="line-clamp-3 break-words text-sm leading-6">
                    <Highlight text={entry.text} query={query} />
                  </p>
                  <PunishmentList items={entry.punishments} />
                </Link>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <p className="px-1 text-sm text-muted-foreground">
          {articles.length} {articles.length === 1 ? "раздел" : "разделов"}
        </p>
        {articles.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Разделов с таким названием нет. Поиск выше ищет и по отдельным пунктам правил.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {articles.map((article) => {
              const Icon = getRuleIcon(article.slug);
              return (
                <Link
                  key={article.slug}
                  href={articleHref(article.group, article.slug)}
                  className="group relative flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium leading-snug">{article.title}</h2>
                    <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-muted-foreground">{article.description}</p>
                  </div>
                  <p className="border-t pt-3 text-xs text-muted-foreground">
                    {article.ruleCount} пунктов · обновлено {article.updatedAt}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export function ChangelogPage({ entries, status }: { entries: ChangelogEntry[]; status: RulesStatus }) {
  return (
    <main className="flex w-full min-w-0 flex-col gap-6 pb-10">
      <section className="relative px-2 pt-12 pb-2 sm:pt-6 md:px-6 md:pt-8">
        <RuleStatusBlock
          state={status.state}
          lastChecked={status.lastChecked}
          className="absolute top-0 right-0 sm:top-1 md:top-2"
        />
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">История изменений</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">Что менялось в правилах проекта и когда.</p>
        </div>
      </section>
      <ChangelogFeed entries={entries} />
    </main>
  );
}
