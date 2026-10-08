import Link from "next/link";

import { ArrowLeft, ArrowRight, ChevronRight, Clock3, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { type Job, jobBlocks, levelLabel, previousStages, readMinutes, unlockedBy } from "../_data/jobs";
import { GuideSections, groupGuideSections } from "./guide-blocks";
import { KindBadge } from "./job-badges";
import { fallbackJobIcon, jobIcons } from "./job-icons";
import { JobImage } from "./job-image";

type Section = { id: string; title: string };

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="min-w-0 break-words rounded-xl border bg-card p-4 text-sm leading-6 shadow-xs md:p-5">
        {children}
      </div>
    </section>
  );
}

function JobLink({ job }: { job: Job }) {
  const Icon = jobIcons[job.slug] ?? fallbackJobIcon;
  return (
    <Link
      href={`/jobs/${job.slug}`}
      prefetch={false}
      className="group flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{job.title}</span>
        <span className="block text-xs text-muted-foreground">{levelLabel(job)}</span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

type JobArticleViewProps = {
  job: Job;
  jobs: Job[];
  /** Кнопки редактирования в шапке (только для тех, у кого есть право) */
  actions?: React.ReactNode;
  /** Предпросмотр в редакторе: ссылки и кнопки отключены, чтобы случайный клик не унёс с несохранённой страницы */
  preview?: boolean;
  /** Вместо готовых разделов гайда показывает переданное содержимое: так страница превращается в редактор */
  guideSlot?: React.ReactNode;
};

/** Страница гайда целиком. Не зависит от сервера, поэтому её же показывает предпросмотр в редакторе. */
export function JobArticleView({ job, jobs, actions, preview, guideSlot }: JobArticleViewProps) {
  const previous = previousStages(job, jobs);
  const next = unlockedBy(job, jobs);
  const guide = groupGuideSections(jobBlocks(job));
  const index = jobs.findIndex((item) => item.slug === job.slug);
  const prevJob = index > 0 ? jobs[index - 1] : undefined;
  const nextJob = index >= 0 ? jobs[index + 1] : undefined;

  const sections: Section[] = [
    { id: "dostup", title: "Условия доступа" },
    ...guide.flatMap((section) => (section.title ? [{ id: section.id, title: section.title }] : [])),
    ...(next.length > 0 ? [{ id: "dalshe", title: "Что открывается дальше" }] : []),
  ];

  return (
    <main inert={preview} className="@container mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 pb-10">
      <section className="rounded-3xl border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-7 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Все работы
          </Link>
          {actions}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <KindBadge kind={job.kind} />
          <Badge variant="secondary" className="rounded-md px-3 py-1">
            {levelLabel(job)}
          </Badge>
          <Badge variant="outline" className="gap-1.5 rounded-md px-3 py-1">
            <Clock3 className="size-3.5" /> {readMinutes(job)} мин чтения
          </Badge>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{job.title}</h1>
        <p className="mt-3 max-w-2xl whitespace-pre-line text-muted-foreground">{job.intro}</p>
        <JobImage
          job={job}
          priority={!preview}
          sizes="(max-width: 1152px) 100vw, 1152px"
          className="mt-6 max-h-[420px] w-full rounded-2xl border"
        />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 @3xl:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Содержание" className="min-w-0 @3xl:sticky @3xl:top-20 @3xl:self-start">
          <p className="mb-2 hidden text-xs font-medium tracking-wide text-muted-foreground uppercase @3xl:block">
            Содержание
          </p>
          <ul className="flex gap-2 overflow-x-auto pb-1 @3xl:flex-col @3xl:gap-1 @3xl:overflow-visible @3xl:pb-0">
            {sections.map((section) => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  className="flex rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-muted/40 @3xl:border-transparent"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
          <Block id="dostup" title="Условия доступа">
            <div className="flex flex-col gap-3">
              <p className="flex items-start gap-2">
                <Lock className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                {job.level === 0
                  ? "Работа доступна сразу после создания персонажа."
                  : `Работа открывается с ${job.level} уровня персонажа.`}
              </p>
              {previous.length > 0 && (
                <>
                  <p>Альтернативный путь: получите 2 ранг на одной из этих работ предыдущего этапа.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {previous.map((item) => (
                      <JobLink key={item.slug} job={item} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </Block>

          {guideSlot ?? <GuideSections sections={guide} />}

          {next.length > 0 && (
            <Block id="dalshe" title="Что открывается дальше">
              <p className="mb-3">2 ранг на этой работе — один из путей к следующим профессиям:</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {next.map((item) => (
                  <JobLink key={item.slug} job={item} />
                ))}
              </div>
            </Block>
          )}

          <nav aria-label="Соседние гайды" className="grid gap-3 sm:grid-cols-2">
            {prevJob ? (
              <Link
                href={`/jobs/${prevJob.slug}`}
                prefetch={false}
                className="group flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <ArrowLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1" />
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">Предыдущая</span>
                  <span className="block truncate text-sm font-medium">{prevJob.title}</span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {nextJob && (
              <Link
                href={`/jobs/${nextJob.slug}`}
                prefetch={false}
                className="group flex items-center justify-end gap-3 rounded-xl border p-4 text-right transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">Следующая</span>
                  <span className="block truncate text-sm font-medium">{nextJob.title}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </nav>

          <p className="text-center text-xs text-muted-foreground">
            Вся информация на сайте носит ознакомительный характер и не является публичной офертой.
          </p>
        </div>
      </div>
    </main>
  );
}
