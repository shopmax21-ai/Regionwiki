"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { ArrowUpRight, Clock3, FileText, RefreshCw, Search, ShieldCheck, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { ChangelogFeed } from "./changelog-feed";
import { Highlight, matchesQuery, PunishmentList } from "./rule-ui";
import {
  articleHref,
  formatRuleRef,
  type RuleArticleCard,
  type RuleGroup,
  type RuleSearchEntry,
  ruleGroups,
  type SyncStatus,
  syncInfo,
  type ChangelogEntry,
} from "./rules-meta";

const MAX_RESULTS = 60;

export function RulesPage({
  group,
  cards,
  searchIndex,
  sync,
}: {
  group: RuleGroup;
  cards: RuleArticleCard[];
  searchIndex: RuleSearchEntry[];
  sync: SyncStatus;
}) {
  const data = ruleGroups[group];
  const [query, setQuery] = useState("");
  const isSearching = query.trim().length > 0;

  const totalRules = useMemo(() => cards.reduce((sum, card) => sum + card.ruleCount, 0), [cards]);

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
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 pb-10">
      <section className="rounded-3xl border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-10">
        <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">{data.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
            <RefreshCw className="size-4 text-primary" /> {syncInfo.interval}
          </div>
        </div>
        <div className="relative mt-7 max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти пункт: например DM, 4.9, Demorgan, перекрытие"
            className="pl-9 pr-9"
            aria-label="Поиск по всем пунктам правил"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
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

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Разделы правил</CardTitle>
              <CardDescription className="mt-1">{articles.length} разделов</CardDescription>
            </div>
            <Badge variant="outline">Актуально</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {articles.map((article, index) => (
            <Link
              key={article.slug}
              href={articleHref(article.group, article.slug)}
              className="group flex items-start gap-3 rounded-xl border p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-medium text-primary">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{article.title}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{article.description}</span>
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  {article.ruleCount} пунктов · обновлено {article.updatedAt}
                </span>
              </span>
              <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Автообновление</CardTitle>
          <CardDescription>Сервис проверяет изменения автоматически</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Clock3 className="size-4" /> Следующая проверка по расписанию
          </span>
          <span className="flex items-center gap-2">
            <FileText className="size-4" /> Последняя: {sync.lastChecked ?? "ещё не проверялось"}
            {sync.lastChecked && !sync.ok ? " (были ошибки)" : ""}
          </span>
        </CardContent>
      </Card>
    </main>
  );
}

export function ChangelogPage({ entries, sync }: { entries: ChangelogEntry[]; sync: SyncStatus }) {
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 pb-10">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">История изменений</h1>
      </section>
      <ChangelogFeed entries={entries} />
    </main>
  );
}
