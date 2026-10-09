"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import { ArrowUpRight, CornerDownLeft, Search, Sparkles, X } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { quickSituations } from "@/lib/rules/search-dictionary";
import { createRuleSearcher, findNoteMatch, textMatchesQuery } from "@/lib/rules/smart-search";

import { ChangelogFeed } from "./changelog-feed";
import { getRuleIcon } from "./rule-icons";
import { RuleResultCard } from "./rule-result-card";
import { RuleSearchNotes } from "./rule-search-notes";
import { RuleStatusBlock } from "./rule-status";
import {
  articleHref,
  type ChangelogEntry,
  type RuleArticleCard,
  type RuleGroup,
  type RuleSearchEntry,
  type RulesStatus,
  ruleGroups,
} from "./rules-meta";
import { entryToDoc } from "./rules-search";
import { useSemanticRules } from "./use-semantic-rules";

const PAGE_SIZE = 30;

export function RulesPage({
  group,
  cards,
  searchIndex,
  status,
  semanticEnabled = false,
}: {
  group: RuleGroup;
  cards: RuleArticleCard[];
  searchIndex: RuleSearchEntry[];
  status: RulesStatus;
  /** Настроен ли поиск по смыслу (embedding API) */
  semanticEnabled?: boolean;
}) {
  const data = ruleGroups[group];
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<{ query: string; slug: string | null; limit: number }>({
    query: "",
    slug: null,
    limit: PAGE_SIZE,
  });
  const [askedQuery, setAskedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Поиск не блокирует набор: тяжёлая часть считается с небольшим отставанием
  const deferredQuery = useDeferredValue(query);
  const isSearching = query.trim().length > 0;

  // Новый запрос начинает выдачу заново: без фильтра по разделу и с первой страницы
  const current = view.query === deferredQuery ? view : { query: deferredQuery, slug: null, limit: PAGE_SIZE };
  const onlySlug = current.slug;
  const limit = current.limit;
  const setOnlySlug = (slug: string | null) => setView({ ...current, slug, limit: PAGE_SIZE });
  const showMore = () => setView({ ...current, limit: current.limit + PAGE_SIZE });

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

  const searcher = useMemo(() => createRuleSearcher(searchIndex.map(entryToDoc)), [searchIndex]);
  const result = useMemo(() => searcher.search(deferredQuery), [searcher, deferredQuery]);

  const countsBySlug = useMemo(() => {
    const counts = new Map<string, number>();
    for (const hit of result.hits) {
      const slug = searchIndex[hit.index].slug;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    return counts;
  }, [result, searchIndex]);

  const visibleHits = useMemo(
    () => (onlySlug ? result.hits.filter((hit) => searchIndex[hit.index].slug === onlySlug) : result.hits),
    [result, onlySlug, searchIndex],
  );

  // Поиск по смыслу подключается сам, когда обычный нашёл мало, или по кнопке
  const trimmed = deferredQuery.trim();
  const lexicalWeak = result.hits.length < 3 || result.partial;
  const semanticAllowed = semanticEnabled && trimmed.length >= 3;
  const semanticRequested = semanticAllowed && (lexicalWeak || askedQuery === deferredQuery);
  const semantic = useSemanticRules({ enabled: semanticAllowed, group, query: semanticRequested ? trimmed : "" });

  const semanticEntries = useMemo(() => {
    const byKey = new Map(searchIndex.map((entry) => [`${entry.slug}#${entry.anchor}`, entry]));
    const lexical = new Set(result.hits.map((hit) => `${searchIndex[hit.index].slug}#${searchIndex[hit.index].anchor}`));
    return semantic.hits
      .map((hit) => byKey.get(`${hit.slug}#${hit.anchor}`))
      .filter((entry): entry is RuleSearchEntry => Boolean(entry) && !lexical.has(`${entry?.slug}#${entry?.anchor}`));
  }, [semantic.hits, searchIndex, result]);

  const visibleSemantic = onlySlug ? semanticEntries.filter((entry) => entry.slug === onlySlug) : semanticEntries;
  const canAskSemantic = semanticAllowed && !semanticRequested;

  const articles = useMemo(() => {
    if (!isSearching) return cards;
    return cards
      .filter(
        (card) => countsBySlug.has(card.slug) || textMatchesQuery(`${card.title} ${card.description}`, deferredQuery),
      )
      .sort((a, b) => (countsBySlug.get(b.slug) ?? 0) - (countsBySlug.get(a.slug) ?? 0));
  }, [cards, isSearching, countsBySlug, deferredQuery]);

  const sectionChips = cards.filter((card) => countsBySlug.has(card.slug));
  const totalShown = visibleHits.length + visibleSemantic.length;
  const waiting = isSearching && deferredQuery !== query;

  const openFirst = () => {
    const first = visibleHits[0];
    const entry = first ? searchIndex[first.index] : visibleSemantic[0];
    if (!entry) return;
    router.push(`${articleHref(entry.group, entry.slug)}#${entry.anchor}`);
  };

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
              onKeyDown={(event) => {
                if (event.key === "Enter") openFirst();
                if (event.key === "Escape") setQuery("");
              }}
              placeholder="Пункт или ситуация: 4.9, DM, убили без причины, перекрыл дорогу"
              className="h-11 rounded-xl pl-10 pr-24"
              aria-label="Умный поиск по всем пунктам правил"
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

          {!isSearching && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">Частые ситуации:</span>
              {quickSituations.map((situation) => (
                <button
                  key={situation.label}
                  type="button"
                  onClick={() => {
                    setQuery(situation.query);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 hover:text-foreground"
                >
                  {situation.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {isSearching && (
        <Card className={cn("transition-opacity", waiting && "opacity-70")}>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>Найденные пункты</CardTitle>
              <CardDescription>
                {result.hits.length > 0
                  ? `Найдено: ${result.hits.length}${onlySlug ? `, в выбранном разделе: ${visibleHits.length}` : ""}`
                  : semantic.loading
                    ? "По словам ничего нет, ищем по смыслу…"
                    : semanticEntries.length > 0
                      ? "По словам ничего нет, но есть пункты, близкие по смыслу."
                      : "Ничего не найдено. Опишите ситуацию другими словами, укажите номер пункта (например, оп 4.9) или часть слова."}
              </CardDescription>
            </div>
            <RuleSearchNotes result={result} />
            {sectionChips.length > 1 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Фильтр по разделам">
                <SectionChip
                  active={onlySlug === null}
                  onClick={() => setOnlySlug(null)}
                  label="Все"
                  count={result.hits.length}
                />
                {sectionChips.map((card) => (
                  <SectionChip
                    key={card.slug}
                    active={onlySlug === card.slug}
                    onClick={() => setOnlySlug(onlySlug === card.slug ? null : card.slug)}
                    label={card.tag ?? card.title}
                    title={card.title}
                    count={countsBySlug.get(card.slug) ?? 0}
                  />
                ))}
              </div>
            )}
          </CardHeader>
          {(totalShown > 0 || semantic.loading || canAskSemantic) && (
            <CardContent className="flex flex-col gap-2">
              {visibleHits.slice(0, limit).map((hit) => {
                const entry = searchIndex[hit.index];
                const note = hit.where.includes("note") ? findNoteMatch(hit.doc, result.highlight) : null;
                return (
                  <RuleResultCard
                    key={`${entry.slug}-${entry.anchor}`}
                    entry={entry}
                    highlight={result.highlight}
                    note={note}
                  />
                );
              })}
              {(visibleSemantic.length > 0 || semantic.loading) && (
                <div className="flex flex-col gap-2 pt-1">
                  <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    {semantic.loading ? "Ищем по смыслу…" : "Похоже по смыслу"}
                  </p>
                  {visibleSemantic.map((entry) => (
                    <RuleResultCard
                      key={`semantic-${entry.slug}-${entry.anchor}`}
                      entry={entry}
                      highlight={null}
                      semantic
                    />
                  ))}
                </div>
              )}
              {semantic.failed && (
                <p className="px-1 text-xs text-muted-foreground">
                  Поиск по смыслу сейчас недоступен, показаны только совпадения по словам.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CornerDownLeft className="size-3.5" aria-hidden="true" />
                  Enter открывает первый результат
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {canAskSemantic && (
                    <button
                      type="button"
                      onClick={() => setAskedQuery(deferredQuery)}
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Sparkles className="size-3.5" aria-hidden="true" />
                      Искать по смыслу
                    </button>
                  )}
                  {visibleHits.length > limit && (
                    <button
                      type="button"
                      onClick={showMore}
                      className="rounded-md border px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Показать ещё ({Math.min(PAGE_SIZE, visibleHits.length - limit)})
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <section className="flex flex-col gap-3">
        {isSearching && articles.length > 0 && (
          <h2 className="px-1 text-sm font-medium text-muted-foreground">Разделы, где есть совпадения</h2>
        )}
        {articles.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {cards.length === 0
              ? "Тексты правил пока не загружены из базы данных. Проверьте подключение и запуск синхронизации."
              : "Разделов с таким названием нет. Поиск выше ищет и по отдельным пунктам правил."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {articles.map((article) => {
              const Icon = getRuleIcon(article.slug);
              const found = countsBySlug.get(article.slug);
              return (
                <Link
                  key={article.slug}
                  href={articleHref(article.group, article.slug)}
                  className="group relative flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:bg-[color-mix(in_oklab,var(--card),black_1.5%)] dark:hover:bg-[color-mix(in_oklab,var(--card),white_6%)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="flex items-center gap-2">
                      {isSearching && found ? (
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          Найдено: {found}
                        </span>
                      ) : null}
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium leading-snug">{article.title}</h2>
                    <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-muted-foreground">{article.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function SectionChip({
  active,
  onClick,
  label,
  count,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground/80")}>
        {count}
      </span>
    </button>
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
