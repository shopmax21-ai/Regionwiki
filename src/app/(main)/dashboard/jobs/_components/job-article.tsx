import Link from "next/link";

import { ArrowLeft, ArrowRight, ChevronRight, Clock3, Compass, Lightbulb, Lock, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { type Job, type JobEditorState, levelLabel, previousStages, readMinutes, unlockedBy } from "../_data/jobs";
import { KindBadge } from "./job-badges";
import { JobDelete } from "./job-delete";
import { JobEditor } from "./job-editor";
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

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: пункты могут повторяться, порядок не меняется
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function JobLink({ job }: { job: Job }) {
  const Icon = jobIcons[job.slug] ?? fallbackJobIcon;
  return (
    <Link
      href={`/dashboard/jobs/${job.slug}`}
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

type JobArticleProps = { job: Job; jobs: Job[]; editor: JobEditorState };

export function JobArticle({ job, jobs, editor }: JobArticleProps) {
  const previous = previousStages(job, jobs);
  const next = unlockedBy(job, jobs);
  const extra = (job.sections ?? []).map((section, i) => ({ ...section, id: `razdel-${i + 1}` }));
  const index = jobs.findIndex((item) => item.slug === job.slug);
  const prevJob = jobs[index - 1];
  const nextJob = jobs[index + 1];

  const sections: Section[] = [
    { id: "dostup", title: "Условия доступа" },
    ...(job.conditions.length > 0 ? [{ id: "usloviya", title: "Экипировка и условия" }] : []),
    ...(job.income.length > 0 || job.navigator ? [{ id: "dohod", title: "Как зарабатывать" }] : []),
    ...(job.process.length > 0 ? [{ id: "protsess", title: "Процесс работы" }] : []),
    ...(job.tips.length > 0 ? [{ id: "sovety", title: "Советы" }] : []),
    ...(job.teamwork ? [{ id: "komanda", title: "Совместная работа" }] : []),
    ...extra.map((section) => ({ id: section.id, title: section.title })),
    ...(next.length > 0 ? [{ id: "dalshe", title: "Что открывается дальше" }] : []),
  ];

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 pb-10">
      <section className="rounded-3xl border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-7 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/jobs"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Все работы
          </Link>
          {editor === "on" && (
            <div className="flex items-center gap-2">
              <JobEditor mode="edit" job={job} allJobs={jobs} />
              <JobDelete slug={job.slug} title={job.title} />
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <KindBadge kind={job.kind} />
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {levelLabel(job)}
          </Badge>
          <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
            <Clock3 className="size-3.5" /> {readMinutes(job)} мин чтения
          </Badge>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{job.title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{job.intro}</p>
        <JobImage
          job={job}
          priority
          sizes="(max-width: 1152px) 100vw, 1152px"
          className="mt-6 max-h-[420px] w-full rounded-2xl border"
        />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Содержание" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 hidden text-xs font-medium tracking-wide text-muted-foreground uppercase lg:block">
            Содержание
          </p>
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {sections.map((section) => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  className="flex rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-muted/40 lg:border-transparent"
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

          {job.conditions.length > 0 && (
            <Block id="usloviya" title="Экипировка и условия">
              <Bullets items={job.conditions} />
            </Block>
          )}

          {(job.income.length > 0 || job.navigator) && (
            <Block id="dohod" title="Как зарабатывать">
              <Bullets items={job.income} />
              {job.navigator && (
                <p className="mt-4 flex items-start gap-2 rounded-lg border-l-2 border-primary bg-primary/5 px-3 py-2">
                  <Compass className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">Навигатор:</span> {job.navigator}
                  </span>
                </p>
              )}
            </Block>
          )}

          {job.process.length > 0 && (
            <Block id="protsess" title="Процесс работы">
              <ol className="flex flex-col gap-3">
                {job.process.map((step, stepIndex) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {stepIndex + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </Block>
          )}

          {job.tips.length > 0 && (
            <Block id="sovety" title="Советы">
              <ul className="flex flex-col gap-2">
                {job.tips.map((tip) => (
                  <li
                    key={tip}
                    className="flex items-start gap-2 rounded-lg border-l-2 border-amber-500/60 bg-amber-500/10 px-3 py-2"
                  >
                    <Lightbulb
                      className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300"
                      aria-hidden="true"
                    />
                    {tip}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {job.teamwork && (
            <Block id="komanda" title="Совместная работа">
              <p className="flex items-start gap-2">
                <Users className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                {job.teamwork}
              </p>
            </Block>
          )}

          {extra.map((section) => (
            <Block key={section.id} id={section.id} title={section.title}>
              {section.items.length > 0 ? (
                <Bullets items={section.items} />
              ) : (
                <p className="text-muted-foreground">Раздел пока пуст.</p>
              )}
            </Block>
          ))}

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
                href={`/dashboard/jobs/${prevJob.slug}`}
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
                href={`/dashboard/jobs/${nextJob.slug}`}
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
