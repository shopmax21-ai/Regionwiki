"use client";

import { cn } from "cn";

import type { RuleFieldKind } from "@/lib/rules/parse";

/** Подсвечивает найденные слова (регулярное выражение строит умный поиск, см. lib/rules/smart-search). */
export function Highlight({ text, regex }: { text: string; regex: RegExp | null }) {
  if (!regex) return <>{text}</>;

  const parts: { value: string; match: boolean }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push({ value: text.slice(cursor, start), match: false });
    parts.push({ value: match[0], match: true });
    cursor = start + match[0].length;
  }
  if (parts.length === 0) return <>{text}</>;
  if (cursor < text.length) parts.push({ value: text.slice(cursor), match: false });

  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark key={`${index}-${part.value}`} className="rounded-sm bg-primary/20 px-0.5 text-foreground">
            {part.value}
          </mark>
        ) : (
          <span key={`${index}-${part.value}`}>{part.value}</span>
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

export function PunishmentList({ items, highlight = null }: { items: string[]; highlight?: RegExp | null }) {
  if (items.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-muted-foreground">Наказание:</span>
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "inline-flex max-w-full items-center whitespace-normal break-words rounded-md border px-2 py-0.5 text-xs font-medium",
            severityClass[severityOf(item)],
          )}
        >
          <Highlight text={item} regex={highlight} />
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
          className={cn(
            "inline-flex max-w-full items-center whitespace-normal break-words rounded-md border px-2 py-0.5 font-medium",
            severityClass[severity],
          )}
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
