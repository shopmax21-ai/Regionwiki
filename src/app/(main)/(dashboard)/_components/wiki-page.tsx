"use client";

import { type ComponentType, useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CarFront,
  HardHat,
  History,
  House,
  LifeBuoy,
  Map as MapIcon,
  Scale,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { RegionMark } from "@/app/(main)/auth/_components/region-mark";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { useSiteSearch } from "@/hooks/use-site-search";

import {
  type KindFilter,
  pluralResults,
  SearchEmpty,
  SearchKindTabs,
  SearchResultGroups,
  SearchSkeleton,
} from "./wiki-search-results";

const FORUM_URL = "https://forum.region.game";

export type WikiStats = {
  rules: number;
  generalArticles: number;
  governmentArticles: number;
  jobs: number;
  businesses: number;
  realties: number;
  vehicles: number;
  places: number;
};

export type RecentArticle = {
  title: string;
  href: string;
  tag?: string;
  group: string;
  updatedAt: string;
  ruleCount: number;
};

function plural(n: number, forms: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let form = forms[2];
  if (mod10 === 1 && mod100 !== 11) form = forms[0];
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = forms[1];
  return `${n} ${form}`;
}

type Section = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  meta?: string;
  href?: string;
};

function buildSections(stats: WikiStats): Section[] {
  return [
    {
      title: "Основные правила",
      description: "Общие правила проекта, игровые ситуации и ответственность игроков",
      icon: Scale,
      meta: `${plural(stats.generalArticles, ["раздел", "раздела", "разделов"])} · ${plural(stats.rules, ["пункт", "пункта", "пунктов"])} в правилах`,
      href: "/rules/general",
    },
    {
      title: "Государственные структуры",
      description: "Правила государственных организаций и фракционной игры",
      icon: Users,
      meta: plural(stats.governmentArticles, ["раздел", "раздела", "разделов"]),
      href: "/rules/government",
    },
    {
      title: "История изменений",
      description: "Что и когда поменялось в правилах: изменения подсвечены по словам",
      icon: History,
      meta: "Следим за форумом",
      href: "/rules/changelog",
    },
    {
      title: "Работы",
      description: "Легальный и нелегальный заработок: с какого уровня доступна работа и что на ней делать",
      icon: HardHat,
      meta: plural(stats.jobs, ["работа", "работы", "работ"]),
      href: "/jobs",
    },
    {
      title: "Бизнес",
      description: "Какие бизнесы есть на сервере, сколько стоят и что приносят",
      icon: BriefcaseBusiness,
      meta: plural(stats.businesses, ["бизнес", "бизнеса", "бизнесов"]),
      href: "/business",
    },
    {
      title: "Недвижимость",
      description: "Дома, квартиры, офисы и склады: цены, гаражи и количество жильцов",
      icon: House,
      meta: plural(stats.realties, ["объект", "объекта", "объектов"]),
      href: "/real-estate",
    },
    {
      title: "Транспорт",
      description: "Автомобили, лицензии, тюнинг и дорожные правила",
      icon: CarFront,
      meta: plural(stats.vehicles, ["машина", "машины", "машин"]),
      href: "/transport",
    },
    {
      title: "Карта штата",
      description: "Важные локации и полезные адреса на интерактивной карте",
      icon: MapIcon,
      meta: plural(stats.places, ["метка", "метки", "меток"]),
      href: "/map",
    },
    {
      title: "Начало игры",
      description: "Всё, что нужно знать перед первым входом на сервер",
      icon: Sparkles,
    },
  ];
}

const suggestions = ["такси", "заправка", "ограбление", "Superior"];

const CSS = `
.wk-accent{color:var(--primary)}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`;

function SectionCard({ section, index }: { section: Section; index: number }) {
  const Icon = section.icon;
  const soon = !section.href;

  const body = (
    <div
      style={{ animationDelay: `${index * 45}ms` }}
      className={cn(
        "group relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border bg-card p-5 transition-colors",
        soon ? "border-dashed bg-muted/30" : "hover:border-primary/50",
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-xl transition-colors",
            soon
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
          )}
        >
          <Icon className="size-6" />
        </span>
        {soon ? (
          <Badge variant="secondary" className="rounded-full">
            Скоро
          </Badge>
        ) : (
          <ArrowUpRight className="size-5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100" />
        )}
      </div>
      <div className="flex-1">
        <h3 className={cn("font-semibold text-lg tracking-tight", soon && "text-muted-foreground")}>{section.title}</h3>
        <p className="mt-1.5 text-muted-foreground text-sm leading-6">{section.description}</p>
      </div>
    </div>
  );

  if (soon) return body;
  return (
    <Link
      href={section.href as string}
      prefetch={false}
      className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {body}
    </Link>
  );
}

export function WikiPage({ stats, recent }: { stats: WikiStats; recent: RecentArticle[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<KindFilter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const trimmed = query.trim();
  const search = useSiteSearch(query, { limit: filter === "all" ? 6 : 30 });
  const sections = buildSections(stats);

  // «/» — быстрый переход к поиску
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const changeQuery = (value: string) => {
    setQuery(value);
    setFilter("all");
  };

  const openFirstResult = () => {
    const group = filter === "all" ? search.groups[0] : search.groups.find((item) => item.kind === filter);
    const hit = group?.hits[0];
    if (!hit) return;
    if (hit.external) window.open(hit.href, "_blank", "noopener,noreferrer");
    else router.push(hit.href);
  };

  const showResults = trimmed.length > 0;

  let statusText = "Ничего не найдено";
  if (!search.active) statusText = "Введите минимум 2 символа";
  else if (search.loading) statusText = "Ищем…";
  else if (search.total > 0) statusText = pluralResults(search.total);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 pb-10">
      <style>{CSS}</style>

      <section className="border-b pb-8 pt-2 md:pb-10">
        <div className="flex max-w-3xl flex-col gap-5">
          <div role="img" aria-label="Region" className="flex items-center gap-2.5 text-foreground">
            <RegionMark gradientId="region-r-grad-home" className="size-8" />
            <span className="font-black text-2xl uppercase italic leading-none tracking-[-0.08em]">Region</span>
          </div>
          <h1 className="max-w-2xl text-balance font-bold text-4xl leading-tight tracking-[-0.035em] md:text-6xl">
            Всё о жизни на <span className="wk-accent">Region</span>
          </h1>
          <p className="max-w-xl text-base text-muted-foreground leading-7 md:text-lg">
            Правила, экономика, транспорт и карта штата — собраны в одном понятном справочнике.
          </p>
          <div className="relative mt-2 max-w-2xl">
            <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") changeQuery("");
                if (event.key === "Enter") openFirstResult();
              }}
              placeholder="Поиск по разделам и материалам"
              aria-label="Поиск по всем разделам"
              className="h-12 rounded-xl border bg-background pr-14 pl-12 text-sm shadow-none focus-visible:border-primary md:h-14 md:text-base"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  changeQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Очистить поиск"
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : (
              <Kbd className="absolute top-1/2 right-4 -translate-y-1/2">/</Kbd>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">Популярное:</span>
            {suggestions.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => {
                  changeQuery(word);
                  inputRef.current?.focus();
                }}
                className="text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary"
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      </section>

      {showResults ? (
        <section aria-live="polite" className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-xl tracking-tight">Результаты поиска</h2>
            <span className="text-muted-foreground text-sm">{statusText}</span>
          </div>

          {search.active && search.loading && <SearchSkeleton />}

          {search.active && !search.loading && search.error && (
            <div className="rounded-2xl border bg-card px-6 py-10 text-center text-muted-foreground text-sm">
              Не удалось выполнить поиск. Проверьте соединение и попробуйте ещё раз.
            </div>
          )}

          {search.active && !search.loading && !search.error && search.total === 0 && (
            <SearchEmpty query={trimmed} suggestions={suggestions} onPick={changeQuery} />
          )}

          {search.active && !search.loading && search.total > 0 && (
            <>
              <SearchKindTabs groups={search.groups} total={search.total} value={filter} onChange={setFilter} />
              <SearchResultGroups groups={search.groups} query={trimmed} filter={filter} />
            </>
          )}
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-semibold text-xl tracking-tight">Разделы</h2>
              <span className="text-muted-foreground text-sm">{sections.length} разделов</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sections.map((section, index) => (
                <SectionCard key={section.title} section={section} index={index} />
              ))}
            </div>
          </section>

          <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <section className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6">
              <div>
                <h2 className="font-semibold text-lg tracking-tight">Недавно обновлённые правила</h2>
                <p className="mt-1 text-muted-foreground text-sm">Свежие изменения, которые стоит перечитать</p>
              </div>
              <ul className="-mx-2 grid grid-cols-[minmax(0,1fr)] gap-1">
                {recent.map((article) => (
                  <li key={article.href} className="min-w-0">
                    <Link
                      href={article.href}
                      prefetch={false}
                      className="group flex min-w-0 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                    >
                      {article.tag && (
                        <span className="flex h-8 min-w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 px-2 font-bold text-primary text-xs">
                          {article.tag}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-sm">{article.title}</span>
                        <span className="mt-0.5 block truncate text-muted-foreground text-xs">
                          {article.group} · {plural(article.ruleCount, ["пункт", "пункта", "пунктов"])}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{article.updatedAt}</span>
                      <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground sm:block" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <aside className="relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground sm:p-6">
              <LifeBuoy
                aria-hidden="true"
                className="absolute -right-6 -bottom-6 -z-10 size-36 rotate-12 text-primary-foreground/10"
              />
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15">
                <LifeBuoy className="size-5" />
              </div>
              <h2 className="mt-4 font-semibold text-lg tracking-tight">Не нашли ответ?</h2>
              <p className="mt-1.5 text-primary-foreground/75 text-sm leading-6">
                Задайте вопрос сообществу на форуме Region или напишите в поддержку.
              </p>
              <a
                href={FORUM_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex items-center gap-2 pt-6 font-medium text-sm hover:underline"
              >
                Открыть форум <ArrowUpRight className="size-4" />
              </a>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

export default WikiPage;
