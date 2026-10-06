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

import { RegionMarkOutline } from "@/app/(main)/auth/_components/region-mark-outline";
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
      href: "/dashboard/rules/general",
    },
    {
      title: "Государственные структуры",
      description: "Правила государственных организаций и фракционной игры",
      icon: Users,
      meta: plural(stats.governmentArticles, ["раздел", "раздела", "разделов"]),
      href: "/dashboard/rules/government",
    },
    {
      title: "История изменений",
      description: "Что и когда поменялось в правилах: изменения подсвечены по словам",
      icon: History,
      meta: "Следим за форумом",
      href: "/dashboard/rules/changelog",
    },
    {
      title: "Работы",
      description: "Легальный и нелегальный заработок: с какого уровня доступна работа и что на ней делать",
      icon: HardHat,
      meta: plural(stats.jobs, ["работа", "работы", "работ"]),
      href: "/dashboard/jobs",
    },
    {
      title: "Бизнес",
      description: "Какие бизнесы есть на сервере, сколько стоят и что приносят",
      icon: BriefcaseBusiness,
      meta: plural(stats.businesses, ["бизнес", "бизнеса", "бизнесов"]),
      href: "/dashboard/business",
    },
    {
      title: "Недвижимость",
      description: "Дома, квартиры, офисы и склады: цены, гаражи и количество жильцов",
      icon: House,
      meta: plural(stats.realties, ["объект", "объекта", "объектов"]),
      href: "/dashboard/real-estate",
    },
    {
      title: "Транспорт",
      description: "Автомобили, лицензии, тюнинг и дорожные правила",
      icon: CarFront,
      meta: plural(stats.vehicles, ["машина", "машины", "машин"]),
      href: "/dashboard/transport",
    },
    {
      title: "Карта штата",
      description: "Важные локации и полезные адреса на интерактивной карте",
      icon: MapIcon,
      meta: plural(stats.places, ["метка", "метки", "меток"]),
      href: "/dashboard/map",
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
.wk-accent{display:inline-block;padding:.04em .16em .04em .08em;margin:-.04em -.16em -.04em -.08em;color:transparent;background-image:linear-gradient(100deg,var(--primary) 38%,#e63f3f 50%,var(--primary) 62%);background-size:300% 100%;background-position:100% 0;-webkit-background-clip:text;background-clip:text;animation:wk-drop .8s cubic-bezier(.2,.9,.3,1.25) both,wk-shine 3.4s ease-in-out .8s infinite}
.wk-rise{animation:wk-rise .55s cubic-bezier(.2,.8,.2,1) both}
.wk-ping{animation:wk-ping 2s cubic-bezier(0,0,.2,1) infinite}
@keyframes wk-drop{from{opacity:0;transform:translateY(-.5em) rotate(-6deg)}to{opacity:1;transform:none}}
@keyframes wk-shine{from{background-position:100% 0}to{background-position:0% 0}}
@keyframes wk-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes wk-ping{75%,100%{transform:scale(2.2);opacity:0}}
@media (prefers-reduced-motion:reduce){.wk-accent,.wk-rise,.wk-ping{animation:none}}
`;

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-2xl tabular-nums tracking-tight">{value.toLocaleString("ru-RU")}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function SectionCard({ section, index }: { section: Section; index: number }) {
  const Icon = section.icon;
  const soon = !section.href;

  const body = (
    <div
      style={{ animationDelay: `${index * 45}ms` }}
      className={cn(
        "wk-rise group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border p-5 transition-all",
        soon
          ? "border-dashed bg-muted/30"
          : "bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
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
      {section.meta && <p className="border-t pt-3 text-muted-foreground text-xs tabular-nums">{section.meta}</p>}
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 pb-10">
      <style>{CSS}</style>

      <section className="relative isolate overflow-hidden rounded-3xl border bg-card">
        {/* Узор из «R», затухающий к тексту */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 -z-10 size-full text-foreground [mask-image:linear-gradient(to_right,transparent_35%,black)]"
        >
          <defs>
            <pattern id="region-home-pattern" width="98" height="64" patternUnits="userSpaceOnUse">
              <g fill="currentColor" fillOpacity="0.06" fontSize="20" fontStyle="italic" fontWeight="800">
                <text x="0" y="24">
                  R
                </text>
                <text x="49" y="24">
                  R
                </text>
                <text x="24" y="56">
                  R
                </text>
                <text x="73" y="56">
                  R
                </text>
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#region-home-pattern)" />
        </svg>

        {/* Фирменная R с бегущей «жидкостью», уходящая за нижний край */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -bottom-20 hidden md:block lg:right-10 lg:-bottom-24"
        >
          <div className="absolute inset-10 rounded-full bg-primary/25 blur-3xl" />
          <RegionMarkOutline id="rmo-home" className="relative w-72 lg:w-[23rem]" />
        </div>

        <div className="relative px-6 py-10 md:px-12 md:py-14">
          <div className="max-w-2xl">

            <h1 className="wk-rise mt-5 text-balance font-extrabold text-4xl leading-[1.05] tracking-tight [animation-delay:60ms] md:text-6xl">
              Всё о жизни на <span className="wk-accent italic">Region</span>
            </h1>
            <p className="wk-rise mt-5 max-w-xl text-base text-muted-foreground leading-7 [animation-delay:120ms] md:text-lg">
              Правила, работы, бизнес, недвижимость и транспорт. Поиск работает по всем разделам сразу, включая текст
              каждого пункта правил.
            </p>

            <div className="wk-rise relative mt-8 max-w-xl [animation-delay:180ms]">
              <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => changeQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") changeQuery("");
                  if (event.key === "Enter") openFirstResult();
                }}
                placeholder="Найти правило, работу, машину или раздел"
                aria-label="Поиск по всем разделам"
                className="h-14 rounded-2xl bg-background pr-14 pl-12 text-base shadow-sm"
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

            <div className="wk-rise mt-4 flex max-w-xl flex-wrap items-center gap-2 text-sm [animation-delay:230ms]">
              <span className="text-muted-foreground">Например:</span>
              {suggestions.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => {
                    changeQuery(word);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border bg-background/70 px-3 py-1 transition-colors hover:border-primary/60 hover:text-primary"
                >
                  {word}
                </button>
              ))}
            </div>

            <dl className="wk-rise mt-9 flex flex-wrap gap-x-10 gap-y-4 border-t pt-6 [animation-delay:280ms]">
              <StatItem value={stats.rules} label="пунктов правил" />
              <StatItem value={stats.jobs} label="работ" />
              <StatItem value={stats.vehicles} label="машин" />
              <StatItem value={stats.realties + stats.businesses} label="объектов и бизнесов" />
            </dl>
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
