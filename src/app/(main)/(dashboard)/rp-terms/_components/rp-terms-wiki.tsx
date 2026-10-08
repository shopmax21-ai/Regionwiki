"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import {
  BookOpen,
  Building2,
  Gavel,
  type LucideIcon,
  Search,
  Terminal,
  TriangleAlert,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { type Category, categories, type TermCategory, terms } from "../_data/terms";

const normalize = (value: string) => value.toLowerCase().replaceAll("ё", "е");

/** Иконка категории термина — стоит в карточке вместо номера, как в разделах правил. */
const categoryIcons: Record<TermCategory, LucideIcon> = {
  Основы: BookOpen,
  Команды: Terminal,
  Нарушения: TriangleAlert,
  Наказания: Gavel,
  Организации: Building2,
};

export function RpTermsWiki({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<Category>("Все");
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSearching = query.trim().length > 0;

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());

    return terms.filter((item) => {
      const matchesCategory = category === "Все" || item.category === category;
      const haystack = normalize(`${item.term} ${item.title} ${item.description} ${item.example ?? ""}`);
      return matchesCategory && haystack.includes(needle);
    });
  }, [category, query]);

  // Ctrl+F (⌘F на Mac) вместо поиска браузера фокусирует поиск по терминам
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.code === "KeyF") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Переход по ссылке вида #mg подсвечивает карточку термина на несколько секунд
  useEffect(() => {
    let timer: number | undefined;
    const apply = () => {
      let id = window.location.hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        // оставляем как есть
      }
      if (!id) return;
      setHighlighted(id);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHighlighted(null), 4000);
    };
    apply();
    window.addEventListener("hashchange", apply);
    window.addEventListener("popstate", apply);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", apply);
      window.removeEventListener("popstate", apply);
    };
  }, []);

  return (
    <main className="flex w-full min-w-0 flex-col gap-6 pb-10">
      <section className="px-2 pt-2 pb-2 md:px-6 md:pt-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">RP термины</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Сокращения, команды и понятия ролевой игры. Точные правила и наказания смотрите в разделе{" "}
            <Link href="/rules/general" className="underline underline-offset-4 hover:text-foreground">
              «Основные правила»
            </Link>
            .
          </p>
          <div className="relative mt-7 w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск термина: MG, /me, респавн..."
              aria-label="Поиск термина"
              className="h-11 rounded-xl pl-10 pr-24"
            />
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {isSearching ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Очистить поиск"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : (
                <kbd className="pointer-events-none hidden rounded-md border bg-muted/50 px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:inline-block">
                  Ctrl + F
                </kbd>
              )}
            </div>
          </div>

          <fieldset className="m-0 mt-4 flex max-w-full min-w-0 justify-start gap-2 overflow-x-auto border-0 p-0 pb-1 sm:flex-wrap sm:justify-center">
            <legend className="sr-only">Категории терминов</legend>
            {categories.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={category === item ? "default" : "outline"}
                aria-pressed={category === item}
                className="shrink-0 rounded-full"
                onClick={() => setCategory(item)}
              >
                {item}
              </Button>
            ))}
          </fieldset>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((item) => {
              const Icon = categoryIcons[item.category];
              return (
                <article
                  key={item.id}
                  id={item.id}
                  className={`group relative flex min-w-0 scroll-mt-24 flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-[background-color,border-color,box-shadow] duration-700 hover:bg-[color-mix(in_oklab,var(--card),black_1.5%)] dark:hover:bg-[color-mix(in_oklab,var(--card),white_6%)] ${
                    highlighted === item.id ? "border-primary bg-primary/5 ring-2 ring-primary/40" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="pt-1 text-xs text-muted-foreground">{item.category}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-xl font-semibold leading-snug tracking-tight">{item.term}</h2>
                    <p className="text-sm text-muted-foreground">{item.title}</p>
                    <p className="mt-3 text-sm leading-6">{item.description}</p>
                  </div>
                  {item.example && (
                    <p className="border-t pt-3 text-sm leading-5 text-muted-foreground">
                      <span className="font-medium text-foreground">Пример: </span>
                      {item.example}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
            Термин не найден. Измените запрос или выберите другую категорию.
          </div>
        )}
      </section>
    </main>
  );
}
