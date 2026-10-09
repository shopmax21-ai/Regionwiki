import Link from "next/link";

import { ArrowUpRight, Sparkles } from "lucide-react";

import { Highlight, PunishmentList } from "./rule-ui";
import { articleHref, formatRuleRef, type RuleSearchEntry } from "./rules-meta";

/** Карточка найденного пункта в выдаче поиска. */
export function RuleResultCard({
  entry,
  highlight,
  note,
  semantic = false,
}: {
  entry: RuleSearchEntry;
  highlight: RegExp | null;
  note?: { label: string; excerpt: string } | null;
  /** Найден по смыслу, а не по словам */
  semantic?: boolean;
}) {
  return (
    <Link
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
        {semantic && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5">
            <Sparkles className="size-3" aria-hidden="true" />
            По смыслу
          </span>
        )}
        <ArrowUpRight className="ml-auto size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
      <p className="line-clamp-3 break-words text-sm leading-6">
        <Highlight text={entry.text} regex={highlight} />
      </p>
      {note && (
        <p className="line-clamp-2 break-words rounded-lg border-l-2 border-primary/40 bg-muted/50 px-3 py-1.5 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">{note.label}: </span>
          <Highlight text={note.excerpt} regex={highlight} />
        </p>
      )}
      <PunishmentList items={entry.punishments} highlight={highlight} />
    </Link>
  );
}
