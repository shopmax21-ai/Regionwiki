"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { ArrowRight, CloudSun, Info, Plus, Search, TriangleAlert, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { type Job, type JobEditorState, type JobKind, jobKinds, levelLabel, pluralJobs } from "../_data/jobs";
import { KindBadge } from "./job-badges";
import { JobImage } from "./job-image";

type Filter = "all" | JobKind;

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "legal", label: "Легальные" },
  { id: "illegal", label: "Нелегальные" },
];

function JobCard({ job, jobs }: { job: Job; jobs: readonly Job[] }) {
  const alt = job.altRanks?.map((slug) => jobs.find((item) => item.slug === slug)?.title).filter(Boolean);

  return (
    <Link href={`/dashboard/jobs/${job.slug}`} prefetch={false} className="group/job block h-full">
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow group-hover/job:ring-primary/50">
        <JobImage
          job={job}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="border-b"
        />
        <CardContent className="flex flex-1 flex-col gap-3 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{job.title}</CardTitle>
            <KindBadge kind={job.kind} />
          </div>
          <CardDescription className="leading-6">{job.tagline}</CardDescription>
          <div className="mt-auto flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{levelLabel(job)}</span>
            {alt && alt.length > 0 && <span>или 2 ранг: {alt.join(" / ")}</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

type JobsHubProps = { jobs: Job[]; editor: JobEditorState; problem?: string | null };

export function JobsHub({ jobs, editor, problem }: JobsHubProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (filter !== "all" && job.kind !== filter) return false;
      return !q || `${job.title} ${job.tagline}`.toLowerCase().includes(q);
    });
  }, [jobs, filter, query]);

  // Для новичков советуем первую работу без уровня; если таких нет, блок не показываем
  const starter = jobs.find((job) => job.level === 0);

  const groups = (Object.keys(jobKinds) as JobKind[])
    .map((kind) => ({ kind, items: filtered.filter((job) => job.kind === kind) }))
    .filter((group) => group.items.length > 0);

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-8 pb-10">
      <section className="relative overflow-hidden rounded-3xl border bg-card px-4 py-8 shadow-sm sm:px-6 md:px-10 md:py-12">
        <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Всё о работах</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
            Работы приносят деньги и открывают новые способы заработка. Одни рассчитаны на спокойную добычу, другие — на
            перевозки, командные задания или риск.
          </p>
          {editor === "on" && (
            <div className="mt-6">
              <Button asChild size="sm">
                <Link href="/dashboard/jobs/new" prefetch={false}>
                  <Plus data-icon="inline-start" /> Добавить работу
                </Link>
              </Button>
            </div>
          )}
          <div className="relative mt-8 max-w-xl">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти работу, например шахтёр или такси"
              aria-label="Поиск по работам"
              className="h-14 rounded-2xl bg-background pr-11 pl-12 text-base shadow-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Очистить поиск"
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {editor === "unavailable" && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-dashed p-4 text-muted-foreground text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Редактирование временно недоступно, показаны встроенные работы.
            {problem && (
              <>
                {" "}
                Причина: <code className="break-all text-xs">{problem}</code>
              </>
            )}
          </span>
        </div>
      )}

      <section className="flex flex-col gap-3" aria-label="Фильтр работ">
        <p className="text-sm text-muted-foreground">
          Большинство работ открывается с нужного уровня персонажа. Альтернатива — получить 2 ранг на одной из двух
          работ предыдущего этапа. Точные условия смотрите в гайде каждой работы.
        </p>
        <fieldset className="m-0 flex min-w-0 gap-2 overflow-x-auto border-0 p-0 pb-1">
          <legend className="sr-only">Тип работ</legend>
          {filters.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={filter === item.id ? "default" : "outline"}
              aria-pressed={filter === item.id}
              className="shrink-0"
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </fieldset>
      </section>

      {groups.length > 0 ? (
        groups.map(({ kind, items }) => (
          <section key={kind} className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{jobKinds[kind].title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{jobKinds[kind].description}</p>
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">
                {items.length} {pluralJobs(items.length)}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((job) => (
                <JobCard key={job.slug} job={job} jobs={jobs} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Ничего не найдено. Измените запрос или выберите другой тип работ.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <Users className="size-5" />
              </div>
              <div>
                <CardTitle>Бонусы и совместная работа</CardTitle>
                <CardDescription>Как увеличить заработок</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm leading-6">
            <p>
              Повышенная оплата зависит от профессии. Бонус может действовать в определённое время суток, при подходящей
              погоде, с подпиской или при работе в группе.
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground">
              <li>У шахтёра, строителя, мусорщика, почтальона и инкассатора есть групповой бонус для 2–4 игроков.</li>
              <li>У электрика групповой бонус выше, чем у остальных.</li>
              <li>Пожарные тушат общий вызов группой до четырёх человек.</li>
              <li>Дальнобойщики открывают конвой отдельным умением.</li>
            </ul>
            <p className="flex items-start gap-2 rounded-lg border-l-2 border-primary bg-primary/5 px-3 py-2">
              <CloudSun className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              Перед стартом откройте гайд: проверьте уровень доступа, стоимость аренды и временные бонусы.
            </p>
          </CardContent>
        </Card>
        {starter && (
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15">
                <Info className="size-5" />
              </div>
              <CardTitle className="mt-4">С чего начать?</CardTitle>
              <CardDescription className="text-primary-foreground/75">
                Новичкам подойдёт «{starter.title}»: она доступна сразу и не требует ничего, кроме желания работать.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={`/dashboard/jobs/${starter.slug}`}
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
              >
                Открыть гайд <ArrowRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Вся информация на сайте носит ознакомительный характер и не является публичной офертой.
      </p>
    </main>
  );
}
