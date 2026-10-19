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
  Map as MapIcon,
  MonitorPlay,
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

/** Короткая подпись статуса актуальности правил для карточки «История изменений». */
export type RulesStatusLabel = { label: string; state: "fresh" | "stale" | "error" | "unknown" };

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

type Tone = "red" | "amber" | "sky";

/** Цвет значка раздела. Классы записаны целиком, чтобы Tailwind их увидел. */
const TONES: Record<Tone, { icon: string; hover: string; chip: string; line: string }> = {
  red: {
    icon: "bg-primary/10 text-primary",
    hover: "group-hover:bg-primary group-hover:text-primary-foreground",
    chip: "bg-primary/10 text-primary",
    line: "from-primary/60",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    hover: "group-hover:bg-amber-500 group-hover:text-white",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    line: "from-amber-500/60",
  },
  sky: {
    icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    hover: "group-hover:bg-sky-500 group-hover:text-white",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    line: "from-sky-500/60",
  },
};

type Section = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  meta?: string;
  href?: string;
};

type SectionGroup = { title: string; hint: string; tone: Tone; sections: Section[] };

function buildGroups(stats: WikiStats, rulesStatus?: RulesStatusLabel): SectionGroup[] {
  return [
    {
      title: "Правила",
      hint: "Что можно и нельзя на проекте",
      tone: "red",
      sections: [
        {
          title: "Основные правила",
          description: "Общие правила проекта и ответственность игроков",
          icon: Scale,
          meta: `${plural(stats.generalArticles, ["раздел", "раздела", "разделов"])} · ${plural(stats.rules, ["пункт", "пункта", "пунктов"])}`,
          href: "/rules/general",
        },
        {
          title: "Государственные структуры",
          description: "Правила государственных организаций",
          icon: Users,
          meta: plural(stats.governmentArticles, ["раздел", "раздела", "разделов"]),
          href: "/rules/government",
        },
        {
          title: "История изменений",
          description: "Обновления и изменения правил",
          icon: History,
          meta: rulesStatus?.label,
          href: "/rules/changelog",
        },
      ],
    },
    {
      title: "Заработок и имущество",
      hint: "Как зарабатывать и во что вкладываться",
      tone: "amber",
      sections: [
        {
          title: "Работы",
          description: "Варианты заработка денег",
          icon: HardHat,
          meta: plural(stats.jobs, ["работа", "работы", "работ"]),
          href: "/jobs",
        },
        {
          title: "Бизнес",
          description: "Отличный способ заработка",
          icon: BriefcaseBusiness,
          meta: plural(stats.businesses, ["бизнес", "бизнеса", "бизнесов"]),
          href: "/business",
        },
        {
          title: "Недвижимость",
          description: "Каталог недвижимости",
          icon: House,
          meta: plural(stats.realties, ["объект", "объекта", "объектов"]),
          href: "/real-estate",
        },
      ],
    },
    {
      title: "Мир Region",
      hint: "Транспорт, места и игроки",
      tone: "sky",
      sections: [
        {
          title: "Транспорт",
          description: "Каталог транспорта",
          icon: CarFront,
          meta: plural(stats.vehicles, ["машина", "машины", "машин"]),
          href: "/transport",
        },
        {
          title: "Карта",
          description: "Важные локации и полезные адреса",
          icon: MapIcon,
          meta: plural(stats.places, ["метка", "метки", "меток"]),
          href: "/map",
        },
        {
          title: "Медиа",
          description: "Трансляции игроков REGION",
          icon: MonitorPlay,
          href: "/media",
        },
      ],
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

function SectionCard({ section, tone, index }: { section: Section; tone: Tone; index: number }) {
  const Icon = section.icon;
  const soon = !section.href;
  const colors = TONES[tone];

  const body = (
    <div
      style={{ animationDelay: `${index * 45}ms` }}
      className={cn(
        "wk-rise hv-reg group relative flex h-full gap-4 overflow-hidden rounded-2xl border p-4 transition-all",
        soon ? "border-dashed bg-muted/30" : "bg-card hover:-translate-y-0.5",
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors",
          soon ? "bg-muted text-muted-foreground" : cn(colors.icon, colors.hover),
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn("font-semibold text-base leading-tight tracking-tight", soon && "text-muted-foreground")}>
            {section.title}
          </h3>
          {soon ? (
            <Badge variant="secondary" className="rounded-full">
              Скоро
            </Badge>
          ) : (
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground group-hover:opacity-100" />
          )}
        </div>
        <p className="text-muted-foreground text-sm leading-5">{section.description}</p>
        {section.meta && (
          <span className={cn("mt-1.5 w-fit rounded-md px-2 py-0.5 font-medium text-xs tabular-nums", colors.chip)}>
            {section.meta}
          </span>
        )}
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

/** Крупные цифры под героем: быстро видно, сколько всего в базе знаний. */
function StatsStrip({ stats }: { stats: WikiStats }) {
  const items = [
    { icon: Scale, value: stats.rules, label: "пунктов правил" },
    { icon: HardHat, value: stats.jobs, label: "работ" },
    { icon: CarFront, value: stats.vehicles, label: "машин в каталоге" },
    { icon: MapIcon, value: stats.places, label: "меток на карте" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ icon: Icon, value, label }, index) => (
        <div
          key={label}
          style={{ animationDelay: `${index * 60}ms` }}
          className="wk-rise flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-extrabold text-2xl tabular-nums italic leading-none">{value}</span>
            <span className="mt-1 text-muted-foreground text-xs leading-tight">{label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const STATUS_DOT: Record<RulesStatusLabel["state"], string> = {
  fresh: "bg-green-500",
  stale: "bg-amber-500",
  error: "bg-destructive",
  unknown: "bg-muted-foreground",
};

/** Свежие правила: список строк-плашек, справа от разделов. */
function RecentList({ recent, rulesStatus }: { recent: RecentArticle[]; rulesStatus?: RulesStatusLabel }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-lg tracking-tight">Недавно обновлено</h2>
        {rulesStatus && (
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <span className={cn("size-2 rounded-full", STATUS_DOT[rulesStatus.state])} aria-hidden="true" />
            {rulesStatus.label}
          </span>
        )}
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {recent.slice(0, 4).map((article) => (
          <li key={article.href}>
            <Link
              href={article.href}
              prefetch={false}
              className="group flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium text-sm">{article.title}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {article.group} · {article.updatedAt}
                </span>
              </span>
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-muted-foreground text-xs tabular-nums">
                {article.ruleCount}
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/rules/changelog"
        prefetch={false}
        className="inline-flex w-fit items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-primary"
      >
        Вся история изменений
        <ArrowRight className="size-3.5" />
      </Link>
    </section>
  );
}

export function WikiPage({
  stats,
  recent,
  rulesStatus,
}: {
  stats: WikiStats;
  recent: RecentArticle[];
  rulesStatus?: RulesStatusLabel;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<KindFilter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const trimmed = query.trim();
  const search = useSiteSearch(query, { limit: filter === "all" ? 6 : 30 });
  const groups = buildGroups(stats, rulesStatus);

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
          <div className="absolute inset-10 rounded-md bg-primary/25 blur-3xl" />
          <RegionMarkOutline id="rmo-home" className="relative w-72 lg:w-[23rem]" />
        </div>

        <div className="relative px-6 py-10 md:px-12 md:py-14">
          <div className="max-w-2xl">
            <h1 className="wk-rise mt-5 text-balance font-extrabold text-4xl leading-[1.05] tracking-tight [animation-delay:60ms] md:text-6xl">
              Всё о жизни на <span className="wk-accent">Region</span>
            </h1>
            <p className="wk-rise mt-5 max-w-xl text-base text-muted-foreground leading-7 [animation-delay:120ms] md:text-lg">
              Здесь Вы можете найти любую информацию о проекте Region, его игровых системах
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
                data-global-search
                aria-keyshortcuts="Control+E"
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
                <Kbd className="absolute top-1/2 right-4 -translate-y-1/2">Ctrl + E</Kbd>
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
                  className="rounded-md border bg-background/70 px-3 py-1 transition-colors hover:border-primary/60 hover:text-primary"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {showResults ? (
        <section aria-live="polite" className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-2xl tracking-tight">Результаты поиска</h2>
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
          <StatsStrip stats={stats} />

          <div className="flex min-w-0 flex-col gap-8">
            <div className="flex min-w-0 flex-col gap-8">
              {groups.map((group, groupIndex) => (
                <section key={group.title} className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <h2 className="font-semibold text-xl tracking-tight">{group.title}</h2>
                      <p className="text-muted-foreground text-sm">{group.hint}</p>
                    </div>
                    <div
                      aria-hidden="true"
                      className={cn("h-px flex-1 bg-gradient-to-r to-transparent", TONES[group.tone].line)}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.sections.map((section, index) => (
                      <SectionCard
                        key={section.title}
                        section={section}
                        tone={group.tone}
                        index={groupIndex * 3 + index}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {recent.length > 0 && <RecentList recent={recent} rulesStatus={rulesStatus} />}
          </div>
        </>
      )}
    </main>
  );
}

export default WikiPage;
