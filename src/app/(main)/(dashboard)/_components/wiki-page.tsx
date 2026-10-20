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

type Tone = "red" | "amber" | "sky" | "violet";

/** Оттенки карточек. Классы записаны целиком, чтобы Tailwind их увидел. */
const TONES: Record<Tone, { icon: string; hover: string; chip: string; glow: string; tint: string }> = {
  red: {
    icon: "bg-primary/10 text-primary",
    hover: "group-hover:bg-primary group-hover:text-primary-foreground",
    chip: "bg-primary/10 text-primary",
    glow: "bg-primary/20",
    tint: "from-primary/[0.07]",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    hover: "group-hover:bg-amber-500 group-hover:text-white",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    glow: "bg-amber-400/20",
    tint: "from-amber-500/[0.07]",
  },
  sky: {
    icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    hover: "group-hover:bg-sky-500 group-hover:text-white",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    glow: "bg-sky-400/20",
    tint: "from-sky-500/[0.07]",
  },
  violet: {
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    hover: "group-hover:bg-violet-500 group-hover:text-white",
    chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    glow: "bg-violet-400/20",
    tint: "from-violet-500/[0.07]",
  },
};

type Section = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone: Tone;
  /** Крупная карточка занимает две колонки сетки */
  wide?: boolean;
  meta?: string;
  href?: string;
};

function buildSections(stats: WikiStats, rulesStatus?: RulesStatusLabel): Section[] {
  return [
    {
      title: "Основные правила",
      description: "Общие правила проекта и ответственность игроков",
      icon: Scale,
      tone: "red",
      wide: true,
      meta: `${plural(stats.generalArticles, ["раздел", "раздела", "разделов"])} · ${plural(stats.rules, ["пункт", "пункта", "пунктов"])}`,
      href: "/rules/general",
    },
    {
      title: "Госструктуры",
      description: "Правила государственных организаций",
      icon: Users,
      tone: "red",
      meta: plural(stats.governmentArticles, ["раздел", "раздела", "разделов"]),
      href: "/rules/government",
    },
    {
      title: "История изменений",
      description: "Обновления и изменения правил",
      icon: History,
      tone: "red",
      meta: rulesStatus?.label,
      href: "/rules/changelog",
    },
    {
      title: "Работы",
      description: "Варианты заработка денег",
      icon: HardHat,
      tone: "amber",
      meta: plural(stats.jobs, ["работа", "работы", "работ"]),
      href: "/jobs",
    },
    {
      title: "Бизнес",
      description: "Отличный способ заработка",
      icon: BriefcaseBusiness,
      tone: "amber",
      meta: plural(stats.businesses, ["бизнес", "бизнеса", "бизнесов"]),
      href: "/business",
    },
    {
      title: "Недвижимость",
      description: "Каталог недвижимости",
      icon: House,
      tone: "amber",
      meta: plural(stats.realties, ["объект", "объекта", "объектов"]),
      href: "/real-estate",
    },
    {
      title: "Транспорт",
      description: "Каталог транспорта",
      icon: CarFront,
      tone: "sky",
      meta: plural(stats.vehicles, ["машина", "машины", "машин"]),
      href: "/transport",
    },
    {
      title: "Карта",
      description: "Важные локации и полезные адреса",
      icon: MapIcon,
      tone: "sky",
      wide: true,
      meta: plural(stats.places, ["метка", "метки", "меток"]),
      href: "/map",
    },
    {
      title: "Медиа",
      description: "Трансляции игроков REGION",
      icon: MonitorPlay,
      tone: "violet",
      wide: true,
      href: "/media",
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

function SectionCard({ section, index }: { section: Section; index: number }) {
  const Icon = section.icon;
  const soon = !section.href;
  const colors = TONES[section.tone];

  const body = (
    <div
      style={{ animationDelay: `${index * 40}ms` }}
      className={cn(
        "wk-rise hv-reg group relative flex h-full min-h-32 flex-col justify-between gap-5 md:min-h-40 md:gap-6 overflow-hidden rounded-3xl border p-5 transition-all",
        soon ? "border-dashed bg-muted/30" : cn("bg-gradient-to-br to-card hover:-translate-y-0.5", colors.tint),
        section.wide && "md:min-h-44 md:p-6",
      )}
    >
      {/* Мягкое свечение в углу, усиливается при наведении */}
      {!soon && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -top-10 -right-10 size-32 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-100",
            colors.glow,
          )}
        />
      )}

      <div className="relative flex items-start justify-between">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-2xl transition-colors",
            soon ? "bg-muted text-muted-foreground" : cn(colors.icon, colors.hover),
          )}
        >
          <Icon className="size-5.5" />
        </span>
        {soon ? (
          <Badge variant="secondary" className="rounded-full">
            Скоро
          </Badge>
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full border bg-background/60 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground group-hover:opacity-100">
            <ArrowUpRight className="size-4" />
          </span>
        )}
      </div>

      <div className="relative flex flex-col gap-1">
        <h3
          className={cn(
            "font-semibold tracking-tight",
            section.wide ? "text-xl" : "text-lg",
            soon && "text-muted-foreground",
          )}
        >
          {section.title}
        </h3>
        <p className="text-muted-foreground text-sm leading-5">{section.description}</p>
        {section.meta && (
          <span className={cn("mt-2 w-fit rounded-full px-2.5 py-0.5 font-medium text-xs tabular-nums", colors.chip)}>
            {section.meta}
          </span>
        )}
      </div>
    </div>
  );

  const span = section.wide ? "md:col-span-2" : "";
  if (soon) return <div className={span}>{body}</div>;
  return (
    <Link
      href={section.href as string}
      prefetch={false}
      className={cn(
        "block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        span,
      )}
    >
      {body}
    </Link>
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
  const sections = buildSections(stats, rulesStatus);

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

      <header className="flex flex-col gap-6 pt-2 md:pt-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="wk-rise text-balance font-extrabold text-3xl leading-[1.05] tracking-tight md:text-5xl">
              Всё о жизни на <span className="wk-accent">Region</span>
            </h1>
            <p className="wk-rise text-muted-foreground [animation-delay:80ms] md:text-lg">
              Правила, работы, транспорт и карта проекта в одном месте
            </p>
          </div>
        </div>

        <div className="wk-rise relative mx-auto w-full max-w-3xl [animation-delay:160ms]">
          {/* Мягкий цветной ореол за полем поиска */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1.5 rounded-[1.75rem] bg-gradient-to-r from-primary/25 via-transparent to-amber-400/25 opacity-60 blur-xl"
          />
          <div className="relative">
            <Search className="absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" />
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
              className="h-14 rounded-3xl border-foreground/10 bg-card pr-24 pl-14 text-base shadow-lg"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  changeQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Очистить поиск"
                className="absolute top-1/2 right-4 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : (
              <Kbd className="absolute top-1/2 right-5 -translate-y-1/2">Ctrl + E</Kbd>
            )}
          </div>
        </div>

        <div className="wk-rise flex flex-wrap items-center justify-center gap-2 text-sm [animation-delay:220ms]">
          <span className="text-muted-foreground">Например:</span>
          {suggestions.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => {
                changeQuery(word);
                inputRef.current?.focus();
              }}
              className="rounded-full border bg-card/70 px-3 py-1 transition-colors hover:border-primary/60 hover:text-primary"
            >
              {word}
            </button>
          ))}
        </div>
      </header>

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
          <section aria-label="Разделы" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {sections.map((section, index) => (
              <SectionCard key={section.title} section={section} index={index} />
            ))}
          </section>

          {recent.length > 0 && <RecentList recent={recent} rulesStatus={rulesStatus} />}
        </>
      )}
    </main>
  );
}

export default WikiPage;
