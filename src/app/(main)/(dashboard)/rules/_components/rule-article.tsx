"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import { ArrowLeft, Check, Copy, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import type { RuleItem, RuleSectionData, SectionEntry } from "../_content/parse";
import { RuleStatusBadge } from "./rule-status";
import { fieldStyles, Highlight, matchesQuery, PunishmentLegend, PunishmentList } from "./rule-ui";
import { formatRuleRef, type RuleArticleView, ruleGroups } from "./rules-meta";

function ruleHaystack(rule: RuleItem): string {
  return [
    rule.number,
    rule.text,
    ...rule.items,
    ...rule.punishments,
    ...rule.fields.flatMap((field) => [field.label, field.text, ...field.items]),
  ].join(" ");
}

function entryMatches(entry: SectionEntry, query: string): boolean {
  if (!query.trim()) return true;
  if (entry.type === "rule") return matchesQuery(ruleHaystack(entry), query);
  return matchesQuery([entry.text, ...entry.items].join(" "), query);
}

function Paragraphs({ text, query, className }: { text: string; query: string; className?: string }) {
  if (!text) return null;
  return (
    <>
      {text.split("\n").map((line, index) => (
        <p key={`${index}-${line.slice(0, 24)}`} className={className}>
          <Highlight text={line} query={query} />
        </p>
      ))}
    </>
  );
}

function BulletList({ items, query }: { items: string[]; query: string }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-6 marker:text-muted-foreground">
      {items.map((item) => (
        <li key={item}>
          <Highlight text={item} query={query} />
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

function RuleCard({ rule, tag, query }: { rule: RuleItem; tag?: string; query: string }) {
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
      className="group/rule min-w-0 scroll-mt-24 break-words rounded-xl border bg-card p-3 sm:p-4 shadow-xs transition-colors target:border-primary target:ring-2 target:ring-primary/30 md:p-5"
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
          <Paragraphs text={rule.text} query={query} className="text-sm leading-6 [&:not(:first-child)]:mt-2" />
          <BulletList items={rule.items} query={query} />
        </div>
      </div>

      {rule.punishments.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <PunishmentList items={rule.punishments} />
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
                {field.text && <Paragraphs text={field.text} query={query} className="inline whitespace-pre-line" />}
                <BulletList items={field.items} query={query} />
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function TextBlock({ entry, query }: { entry: Extract<SectionEntry, { type: "text" }>; query: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm leading-6">
      <Paragraphs text={entry.text} query={query} className="[&:not(:first-child)]:mt-2" />
      <BulletList items={entry.items} query={query} />
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

  const sections = useMemo(
    () =>
      article.sections
        .map((section) => ({ ...section, entries: section.entries.filter((entry) => entryMatches(entry, query)) }))
        .filter((section) => section.entries.length > 0),
    [article.sections, query],
  );

  const shownRules = sections.reduce((total, section) => total + ruleCountOf(section), 0);
  const isFiltering = query.trim().length > 0;

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 pb-10">
      <section className="rounded-3xl border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-7 md:px-10">
        <Link
          href={`/rules/${article.group}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {groupMeta.title}
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Обновлено {article.updatedAt}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {article.ruleCount} пунктов
          </Badge>
          <RuleStatusBadge state={article.status.state} className="px-3 py-1" />
          {article.status.checkedAt && (
            <span className="text-muted-foreground text-xs">Проверено {article.status.checkedAt}</span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{article.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{article.description}</p>

        <div className="relative mt-6 max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Номер пункта или слова из правила, например 4.9 или DM (Ctrl + F)"
            className="pl-9 pr-9"
            aria-label="Поиск по пунктам раздела"
          />
          {isFiltering && (
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
        <div className="mt-4">
          <PunishmentLegend />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Разделы" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
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
            <p className="text-sm text-muted-foreground">
              {shownRules > 0
                ? `Найдено пунктов: ${shownRules}`
                : "Ничего не найдено. Попробуйте другие слова или номер пункта."}
            </p>
          )}

          {sections.map((section) => (
            <section key={section.id} id={section.id} className="flex scroll-mt-24 flex-col gap-3">
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              {section.entries.map((entry) =>
                entry.type === "rule" ? (
                  <RuleCard key={entry.anchor} rule={entry} tag={article.tag} query={query} />
                ) : (
                  <TextBlock
                    key={`${section.id}-${entry.text.slice(0, 32)}-${entry.items.length}`}
                    entry={entry}
                    query={query}
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
