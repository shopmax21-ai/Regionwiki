"use client";

import { cn } from "cn";

import type { RuleFieldKind } from "../_content/parse";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function queryTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** Все слова запроса должны встретиться в тексте (регистр не важен). */
export function matchesQuery(haystack: string, query: string): boolean {
  const terms = queryTerms(query);
  if (terms.length === 0) return true;
  const lower = haystack.toLowerCase();
  return terms.every((term) => lower.includes(term));
}

export function Highlight({ text, query }: { text: string; query: string }) {
  const terms = queryTerms(query);
  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={`${index}-${part}`} className="rounded-sm bg-primary/20 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={`${index}-${part}`}>{part}</span>
        ),
      )}
    </>
  );
}

type Severity = "severe" | "strict" | "light" | "neutral";

function severityOf(punishment: string): Severity {
  if (/чёрный список|черный список|\bчс\b|hard\s?ban|снятие|обнуление|расформир|перманент/i.test(punishment)) {
    return "severe";
  }
  if (
    /\bban\b|\bбан|warn|warm|gunban|выговор|изъятие|заморозк|kick|блокировка|аннулирование|откат|удаление/i.test(
      punishment,
    )
  ) {
    return "strict";
  }
  if (/mute|мут|demorgan|деморган|беседа/i.test(punishment)) return "light";
  return "neutral";
}

const severityClass: Record<Severity, string> = {
  severe: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  strict: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  light: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  neutral: "border-border bg-muted text-foreground",
};

export function PunishmentList({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-muted-foreground">Наказание:</span>
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium break-words",
            severityClass[severityOf(item)],
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function PunishmentLegend() {
  const entries: [Severity, string][] = [
    ["light", "Mute / Demorgan / беседа"],
    ["strict", "Warn / Ban / выговор / изъятие"],
    ["severe", "Hard Ban / ЧС / снятие / обнуление"],
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Меры наказания:</span>
      {entries.map(([severity, label]) => (
        <span
          key={severity}
          className={cn("inline-flex items-center rounded-md border px-2 py-0.5 font-medium", severityClass[severity])}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export const fieldStyles: Record<RuleFieldKind, { box: string; label: string }> = {
  note: { box: "border-sky-500/60 bg-sky-500/5", label: "text-sky-700 dark:text-sky-300" },
  explanation: { box: "border-slate-400/70 bg-muted/50", label: "text-slate-600 dark:text-slate-300" },
  example: { box: "border-violet-500/60 bg-violet-500/5", label: "text-violet-700 dark:text-violet-300" },
  exception: { box: "border-emerald-500/60 bg-emerald-500/5", label: "text-emerald-700 dark:text-emerald-300" },
};
