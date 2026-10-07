"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight, Funnel, Search } from "lucide-react";

import { FilterDropdown } from "@/app/(main)/dashboard/_components/filter-dropdown";
import { DeleteRecordButton } from "@/app/(main)/dashboard/_components/record-dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { type Category, categories, type Realty, realtyTitle } from "../_data/realties";
import { RealtyCard } from "./realty-card";
import { RealtyEditor } from "./realty-editor";

const PAGE_SIZE = 24;

const sortOptions = [
  { id: "new", label: "Сначала новые" },
  { id: "old", label: "Сначала старые" },
  { id: "expensive", label: "Сначала дорогие" },
  { id: "cheap", label: "Сначала дешёвые" },
] as const;

type SortId = (typeof sortOptions)[number]["id"];

type RealtyWikiProps = {
  initialQuery?: string;
  realties: Realty[];
  /** on — можно менять, unavailable — права есть, но базы нет, off — просто просмотр */
  editor: "on" | "off" | "unavailable";
};

export function RealtyWiki({ initialQuery = "", realties, editor }: RealtyWikiProps) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<Category>("Все");
  const [sort, setSort] = useState<SortId>("new");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return realties
      .filter((realty) => {
        const matchesCategory = category === "Все" || realty.category === category;
        const haystack = `${realtyTitle(realty)} ${realty.id}`.toLowerCase();
        return matchesCategory && haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sort === "old") return a.id - b.id;
        if (sort === "expensive") return b.price - a.price || b.id - a.id;
        if (sort === "cheap") return a.price - b.price || b.id - a.id;
        return b.id - a.id;
      });
  }, [category, query, realties, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-col items-center gap-3 py-4 text-center md:py-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Таблица недвижимости</h1>
        {editor === "on" && <RealtyEditor mode="create" />}
        {editor === "unavailable" && (
          <p role="status" className="max-w-xl rounded-lg border border-dashed px-3 py-2 text-muted-foreground text-xs">
            База данных недоступна: показаны встроенные данные, добавление и редактирование отключены.
          </p>
        )}
      </header>

      <section className="flex flex-col gap-3" aria-label="Фильтры недвижимости">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Поиск по номеру или названию..."
              aria-label="Поиск недвижимости"
              className="h-10 pl-9"
            />
          </div>
          <Separator orientation="vertical" className="hidden h-6 data-vertical:self-center lg:block" />
          <FilterDropdown
            icon={Funnel}
            label="Сортировка"
            value={sort}
            options={sortOptions}
            onChange={(value) => {
              setSort(value);
              setPage(1);
            }}
            className="max-lg:w-full"
          />
        </div>

        <fieldset className="m-0 flex min-w-0 gap-2 overflow-x-auto border-0 p-0 pb-1">
          <legend className="sr-only">Типы недвижимости</legend>
          {categories.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={category === item ? "default" : "outline"}
              aria-pressed={category === item}
              className="shrink-0"
              onClick={() => {
                setCategory(item);
                setPage(1);
              }}
            >
              {item}
            </Button>
          ))}
        </fieldset>
      </section>

      {visible.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((realty) => (
            <RealtyCard
              key={realty.id}
              realty={realty}
              actions={
                editor === "on" ? (
                  <>
                    <RealtyEditor mode="edit" realty={realty} />
                    <DeleteRecordButton
                      iconOnly
                      endpoint={`/api/realties/${realty.id}`}
                      noun="объект"
                      name={realtyTitle(realty)}
                      successMessage="Объект удалён"
                    />
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Недвижимость не найдена. Измените запрос или выберите другой тип.
        </div>
      )}

      <footer className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          Найдено {filtered.length.toLocaleString("ru-RU")} из {realties.length.toLocaleString("ru-RU")} объектов
          недвижимости
        </p>
        {pageCount > 1 && (
          <nav className="flex items-center gap-2" aria-label="Страницы каталога">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              <ChevronLeft data-icon="inline-start" /> Назад
            </Button>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              Страница {currentPage} из {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Вперёд <ChevronRight data-icon="inline-end" />
            </Button>
          </nav>
        )}
      </footer>

      <p className="text-center text-xs text-muted-foreground">
        Вся информация на сайте носит ознакомительный характер и не является публичной офертой.
      </p>
    </main>
  );
}
