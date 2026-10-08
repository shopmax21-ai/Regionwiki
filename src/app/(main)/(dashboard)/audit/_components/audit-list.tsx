import Link from "next/link";

import { Calendar, FilePen, Gavel, GraduationCap, Lock, ShieldCheck } from "lucide-react";

import { PersonName } from "@/components/person-name";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/academy/format";
import {
  type AuditCategory,
  type AuditEntry,
  type AuditSeverity,
  CATEGORY_LABELS,
  SEVERITY_LABELS,
} from "@/lib/audit/types";

const CATEGORY_ICONS: Record<AuditCategory, typeof Lock> = {
  access: ShieldCheck,
  roles: Lock,
  content: FilePen,
  punishments: Gavel,
  academy: GraduationCap,
  calendar: Calendar,
};

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  if (severity === "critical") return <Badge variant="destructive">{SEVERITY_LABELS.critical}</Badge>;
  if (severity === "important") {
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
        {SEVERITY_LABELS.important}
      </Badge>
    );
  }
  return <Badge variant="secondary">{SEVERITY_LABELS.normal}</Badge>;
}

type Filters = { category?: string; severity?: string; actor?: string; q?: string };

function moreHref(filters: Filters, before: string): string {
  const query = new URLSearchParams();
  if (filters.category) query.set("category", filters.category);
  if (filters.severity) query.set("severity", filters.severity);
  if (filters.actor) query.set("actor", filters.actor);
  if (filters.q) query.set("q", filters.q);
  query.set("before", before);
  return `/audit?${query.toString()}`;
}

function firstPageHref(filters: Filters): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const text = query.toString();
  return `/audit${text ? `?${text}` : ""}`;
}

/** Список записей журнала: новые сверху. Подробности («было / стало», организатор и т.п.) раскрываются по клику. */
export function AuditList({
  entries,
  nextBefore,
  filters,
  continued,
}: {
  entries: AuditEntry[];
  nextBefore: string | null;
  filters: Filters;
  /** Открыта не первая страница (пришли по «Показать ещё из прошлого») */
  continued: boolean;
}) {
  const filtered = [filters.category, filters.severity, filters.actor, filters.q].some(Boolean);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {entries.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground text-sm">
            {filtered
              ? "По этим фильтрам записей нет. Сбросьте фильтры или измените поиск."
              : "Журнал пока пуст. Записи появятся, когда администрация начнёт вносить изменения."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {entries.map((entry) => {
              const Icon = CATEGORY_ICONS[entry.category];
              const details = Object.entries(entry.details);
              return (
                <li key={entry.id} className="flex items-start gap-3 py-3">
                  <span
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm leading-snug">{entry.summary}</span>
                      <SeverityBadge severity={entry.severity} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                      <PersonName person={entry.actor} avatar />
                      <span>{CATEGORY_LABELS[entry.category]}</span>
                      <time dateTime={entry.at}>{formatDateTime(entry.at)} (МСК)</time>
                    </div>
                    {details.length > 0 && (
                      <details className="group text-xs">
                        <summary className="w-fit cursor-pointer text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                          Подробности
                        </summary>
                        <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 sm:grid-cols-[max-content_1fr]">
                          {details.map(([key, value]) => (
                            <div key={key} className="contents">
                              <dt className="text-muted-foreground">{key}</dt>
                              <dd className="whitespace-pre-line break-words">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {(nextBefore !== null || continued) && (
          <div className="flex flex-wrap justify-center gap-2">
            {continued && (
              <Link href={firstPageHref(filters)} className={buttonVariants({ variant: "outline" })}>
                К новым записям
              </Link>
            )}
            {nextBefore && (
              <Link href={moreHref(filters, nextBefore)} className={buttonVariants({ variant: "outline" })}>
                Показать более ранние
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
