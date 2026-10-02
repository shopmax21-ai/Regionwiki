"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { ArrowLeft, Hash, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import type { RuleItem, RuleSectionData, SectionEntry } from "../_content/parse";
import { fieldStyles, Highlight, matchesQuery, PunishmentLegend, PunishmentList } from "./rule-ui";
import { type RuleArticleView, ruleGroups } from "./rules-meta";

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

function RuleCard({ rule, query }: { rule: RuleItem; query: string }) {
  return (
    <article
      id={rule.anchor}
      className="group/rule scroll-mt-24 rounded-xl border bg-card p-4 shadow-xs transition-colors target:border-primary target:ring-2 target:ring-primary/30 md:p-5"
    >
      <div className="flex items-start gap-3">
        <a
          href={`#${rule.anchor}`}
          aria-label={`Ссылка на пункт ${rule.number}`}
          className="mt-0.5 inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2 text-sm font-semibold text-primary hover:bg-primary/15"
        >
          <Hash className="size-3.5 opacity-60" />
          {rule.number}
        </a>
        <div className="min-w-0 flex-1">
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
                className={`rounded-lg border-l-2 px-3 py-2 text-sm leading-6 ${style.box}`}
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <section className="rounded-3xl border bg-card px-6 py-7 shadow-sm md:px-10">
        <Link
          href={`/dashboard/rules/${article.group}`}
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
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{article.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{article.description}</p>

        <div className="relative mt-6 max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Номер пункта или слова из правила, например 4.9 или DM"
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

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Разделы" className="lg:sticky lg:top-20 lg:self-start">
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

        <div className="flex min-w-0 flex-col gap-8">
          {isFiltering && (
            <p className="text-sm text-muted-foreground">
              {shownRules > 0 ? `Найдено пунктов: ${shownRules}` : "Ничего не найдено. Попробуйте другие слова или номер пункта."}
            </p>
          )}

          {sections.map((section) => (
            <section key={section.id} id={section.id} className="flex scroll-mt-24 flex-col gap-3">
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              {section.entries.map((entry) =>
                entry.type === "rule" ? (
                  <RuleCard key={entry.anchor} rule={entry} query={query} />
                ) : (
                  <TextBlock key={`${section.id}-${entry.text.slice(0, 32)}-${entry.items.length}`} entry={entry} query={query} />
                ),
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
