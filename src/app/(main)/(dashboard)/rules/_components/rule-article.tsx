"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import { ArrowLeft, Check, Copy, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { RuleItem, RuleSectionData, TextItem } from "@/lib/rules/parse";
import { createRuleSearcher } from "@/lib/rules/smart-search";

import { RuleSearchNotes } from "./rule-search-notes";
import { RuleStatusBlock } from "./rule-status";
import { fieldStyles, Highlight, PunishmentLegend, PunishmentList } from "./rule-ui";
import { formatRuleRef, type RuleArticleView, ruleGroups } from "./rules-meta";
import { articleToDocs, textBlockKey } from "./rules-search";

function Paragraphs({ text, regex, className }: { text: string; regex: RegExp | null; className?: string }) {
  if (!text) return null;
  return (
    <>
      {text.split("\n").map((line, index) => (
        <p key={`${index}-${line.slice(0, 24)}`} className={className}>
          <Highlight text={line} regex={regex} />
        </p>
      ))}
    </>
  );
}

function BulletList({ items, regex }: { items: string[]; regex: RegExp | null }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-6 marker:text-muted-foreground">
      {items.map((item) => (
        <li key={item}>
          <Highlight text={item} regex={regex} />
        </li>
      ))}
    </ul>
  );
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Запасной вариант для небезопасного контекста (http) и старых браузеров
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(area);
    }
  }
}

function RuleCard({
  rule,
  tag,
  regex,
  highlighted,
}: {
  rule: RuleItem;
  tag?: string;
  regex: RegExp | null;
  highlighted: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const reference = formatRuleRef(tag, rule.number);

  const handleCopy = async () => {
    const ok = await copyText(reference);
    if (!ok) return;
    window.history.replaceState(null, "", `#${rule.anchor}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <article
      id={rule.anchor}
      className={`group/rule min-w-0 scroll-mt-24 break-words rounded-xl border bg-card p-3 sm:p-4 shadow-xs transition-[background-color,border-color,box-shadow] duration-700 md:p-5 ${
        highlighted ? "border-primary bg-primary/5 ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-3">
        <button
          type="button"
          onClick={handleCopy}
          title={`Копировать «${reference}»`}
          aria-label={`Копировать ${reference}`}
          className="mt-0.5 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 active:scale-95"
        >
          {reference}
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5 opacity-60" />}
          <span role="status" aria-live="polite" className="sr-only">
            {copied ? "Скопировано" : ""}
          </span>
        </button>
        <div className="min-w-0 w-full flex-1">
          <Paragraphs text={rule.text} regex={regex} className="text-sm leading-6 [&:not(:first-child)]:mt-2" />
          <BulletList items={rule.items} regex={regex} />
        </div>
      </div>

      {rule.punishments.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <PunishmentList items={rule.punishments} highlight={regex} />
        </div>
      )}

      {rule.fields.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {rule.fields.map((field, index) => {
            const style = fieldStyles[field.kind];
            return (
              <div
                key={`${field.label}-${index}-${field.text.slice(0, 20)}`}
                className={`min-w-0 rounded-lg border-l-2 px-3 py-2 text-sm leading-6 ${style.box}`}
              >
                <span className={`mr-1.5 font-semibold ${style.label}`}>{field.label}:</span>
                {field.text && <Paragraphs text={field.text} regex={regex} className="inline whitespace-pre-line" />}
                <BulletList items={field.items} regex={regex} />
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function TextBlock({ entry, regex }: { entry: TextItem; regex: RegExp | null }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm leading-6">
      <Paragraphs text={entry.text} regex={regex} className="[&:not(:first-child)]:mt-2" />
      <BulletList items={entry.items} regex={regex} />
    </div>
  );
}

function ruleCountOf(section: RuleSectionData): number {
  return section.entries.filter((entry) => entry.type === "rule").length;
}

export function RuleArticleViewer({ article }: { article: RuleArticleView }) {
  const [query, setQuery] = useState("");
  const groupMeta = ruleGroups[article.group];
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  // Переход по ссылке вида #rule-1-3 (из истории изменений или поиска) подсвечивает пункт на несколько секунд
  useEffect(() => {
    let timer: number | undefined;
    const apply = () => {
      let id = window.location.hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        // оставляем как есть
      }
      if (!id) return;
      setHighlighted(id);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHighlighted(null), 4000);
    };
    apply();
    window.addEventListener("hashchange", apply);
    window.addEventListener("popstate", apply);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", apply);
      window.removeEventListener("popstate", apply);
    };
  }, []);

  // Ctrl+F (⌘F на Mac) вместо поиска браузера фокусирует поиск по разделу
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

  const deferredQuery = useDeferredValue(query);
  const searcher = useMemo(() => createRuleSearcher(articleToDocs(article)), [article]);
  const result = useMemo(() => searcher.search(deferredQuery), [searcher, deferredQuery]);
  const isFiltering = query.trim().length > 0;

  // Остаются только найденные пункты, порядок и разделы сохраняются как в правилах
  const sections = useMemo(() => {
    if (!deferredQuery.trim()) return article.sections;
    const found = new Set(result.hits.map((hit) => hit.doc.key));
    return article.sections
      .map((section) => ({
        ...section,
        entries: section.entries.filter((entry, position) =>
          found.has(entry.type === "rule" ? entry.anchor : textBlockKey(section.id, position)),
        ),
      }))
      .filter((section) => section.entries.length > 0);
  }, [article.sections, deferredQuery, result]);

  const shownRules = sections.reduce((total, section) => total + ruleCountOf(section), 0);
  const regex = isFiltering ? result.highlight : null;

  return (
    <main className="flex w-full min-w-0 flex-col gap-6 pb-10">
      <section className="relative px-2 pt-12 pb-2 sm:pt-6 md:px-6 md:pt-8">
        <RuleStatusBlock
          state={article.status.state}
          lastChecked={article.status.checkedAt}
          className="absolute top-0 right-0 sm:top-1 md:top-2"
        />
        <Link
          href={`/rules/${article.group}`}
          className="absolute top-14 left-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:top-7 md:top-9 md:left-6"
        >
          <ArrowLeft className="size-4" /> {groupMeta.title}
        </Link>
        <div className="mx-auto flex max-w-2xl flex-col items-center pt-8 text-center sm:pt-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{article.title}</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">{article.description}</p>
          <div className="relative mt-7 w-full">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Номер пункта, слова или ситуация: 4.9, DM, убили без причины"
              className="h-11 rounded-xl pl-10 pr-24"
              aria-label="Поиск по пунктам раздела"
            />
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {isFiltering ? (
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
          <div className="mt-4">
            <PunishmentLegend />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Разделы"
          className="sticky top-[calc(var(--dashboard-header-height)+1rem)] z-20 -mx-1 min-w-0 self-start bg-background/90 px-1 py-2 backdrop-blur-sm max-lg:w-[calc(100%+0.5rem)] lg:max-h-[calc(100svh-var(--dashboard-header-height)-2rem)] lg:overflow-y-auto lg:bg-transparent lg:py-0 lg:backdrop-blur-none"
        >
          <p className="mb-2 hidden text-xs font-medium uppercase tracking-wide text-muted-foreground lg:block">
            Разделы
          </p>
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {sections.map((section) => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-muted/40 lg:border-transparent"
                >
                  <span className="min-w-0 flex-1 lg:truncate">{section.title}</span>
                  <span className="text-xs text-muted-foreground">{ruleCountOf(section) || ""}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
          {isFiltering && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {shownRules > 0
                  ? `Найдено пунктов: ${shownRules}`
                  : "Ничего не найдено. Опишите ситуацию другими словами или укажите номер пункта."}
              </p>
              <RuleSearchNotes result={result} />
            </div>
          )}

          {sections.map((section) => (
            <section key={section.id} id={section.id} className="flex scroll-mt-24 flex-col gap-3">
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              {section.entries.map((entry) =>
                entry.type === "rule" ? (
                  <RuleCard
                    key={entry.anchor}
                    rule={entry}
                    tag={article.tag}
                    regex={regex}
                    highlighted={highlighted === entry.anchor}
                  />
                ) : (
                  <TextBlock
                    key={`${section.id}-${entry.text.slice(0, 32)}-${entry.items.length}`}
                    entry={entry}
                    regex={regex}
                  />
                ),
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
