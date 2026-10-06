"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { type Category, categories, terms } from "../_data/terms";

const normalize = (value: string) => value.toLowerCase().replaceAll("ё", "е");

export function RpTermsWiki({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<Category>("Все");

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());

    return terms.filter((item) => {
      const matchesCategory = category === "Все" || item.category === category;
      const haystack = normalize(`${item.term} ${item.title} ${item.description} ${item.example ?? ""}`);
      return matchesCategory && haystack.includes(needle);
    });
  }, [category, query]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-col items-center gap-3 py-4 text-center md:py-6">
        <h1 className="font-semibold text-3xl tracking-tight md:text-5xl">RP термины</h1>
        <p className="max-w-xl text-muted-foreground text-sm md:text-base">
          Сокращения, команды и понятия ролевой игры. Точные правила и наказания смотрите в разделе{" "}
          <Link href="/dashboard/rules/general" className="underline underline-offset-4 hover:text-foreground">
            «Основные правила»
          </Link>
          .
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-label="Фильтры терминов">
        <div className="relative min-w-0">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск термина: MG, /me, респавн..."
            aria-label="Поиск термина"
            className="h-10 pl-9"
          />
        </div>

        <fieldset className="m-0 flex min-w-0 gap-2 overflow-x-auto border-0 p-0 pb-1">
          <legend className="sr-only">Категории терминов</legend>
          {categories.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={category === item ? "default" : "outline"}
              aria-pressed={category === item}
              className="shrink-0"
              onClick={() => setCategory(item)}
            >
              {item}
            </Button>
          ))}
        </fieldset>
      </section>

      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Card key={item.id} id={item.id} className="gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words font-semibold text-2xl tracking-tight">{item.term}</h2>
                  <p className="text-muted-foreground text-sm">{item.title}</p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {item.category}
                </Badge>
              </div>
              <p className="text-sm leading-6">{item.description}</p>
              {item.example && (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-muted-foreground text-sm">
                  <span className="font-medium text-foreground">Пример: </span>
                  {item.example}
                </p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Термин не найден. Измените запрос или выберите другую категорию.
        </div>
      )}

      <p className="text-center text-muted-foreground text-sm">Найдено терминов: {filtered.length}</p>
    </main>
  );
}
