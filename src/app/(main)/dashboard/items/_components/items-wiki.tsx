"use client";

import { useMemo, useState } from "react";

import Image from "next/image";

import { ChevronLeft, ChevronRight, Funnel, Grid2X2, List, Search, Sparkles } from "lucide-react";

import { FilterDropdown } from "@/app/(main)/dashboard/_components/filter-dropdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { type Category, categories, compareByCategory, itemKey, items, pluralItems } from "../_data/items";
import { categoryIcons, ItemCard, type ItemCardView } from "./item-card";

const PAGE_SIZE = 48;

const sortOptions = [
  { id: "new", label: "Сначала новые" },
  { id: "old", label: "Сначала старые" },
  { id: "name", label: "По названию (А–Я)" },
] as const;

type SortId = (typeof sortOptions)[number]["id"];

export function ItemsWiki({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<Category>("Все");
  const [sort, setSort] = useState<SortId>("new");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ItemCardView>("grid");
  const [selectedItem, setSelectedItem] = useState<(typeof items)[number] | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase().replaceAll("ё", "е");

    return items
      .filter((item) => {
        const matchesCategory = category === "Все" || item.category === category;
        const haystack = `${item.name} ${item.category} ${item.id}`.toLowerCase().replaceAll("ё", "е");
        return matchesCategory && haystack.includes(needle);
      })
      .sort((a, b) => {
        if (sort === "old") return a.id - b.id;
        if (sort === "name") return a.name.localeCompare(b.name, "ru") || compareByCategory(a, b);
        return b.id - a.id;
      });
  }, [category, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-col items-center gap-3 py-4 text-center md:py-6">
        <Badge variant="secondary" className="gap-2 rounded-full px-3 py-1">
          <Sparkles data-icon="inline-start" /> Region Wiki
        </Badge>
        <h1 className="font-semibold text-3xl tracking-tight md:text-5xl">Таблица предметов</h1>
        <p className="max-w-xl text-muted-foreground text-sm md:text-base">
          Продукты, инструменты, материалы, одежда и другие предметы проекта
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-label="Фильтры предметов">
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
              placeholder="Поиск предмета..."
              aria-label="Поиск предмета"
              className="h-10 pl-9"
            />
          </div>
          <Separator orientation="vertical" className="hidden h-6 data-vertical:self-center lg:block" />
          <div className="flex items-center gap-2 max-lg:w-full">
            <FilterDropdown
              icon={Funnel}
              label="Сортировка"
              value={sort}
              options={sortOptions}
              onChange={(value) => {
                setSort(value);
                setPage(1);
              }}
              className="max-lg:flex-1"
            />
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(value) => value && setView(value as ItemCardView)}
              variant="outline"
              size="sm"
              aria-label="Вид списка предметов"
            >
              <ToggleGroupItem value="grid" aria-label="Плитка">
                <Grid2X2 data-icon="inline-start" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Список">
                <List data-icon="inline-start" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <fieldset className="m-0 flex min-w-0 gap-2 overflow-x-auto border-0 p-0 pb-1">
          <legend className="sr-only">Категории предметов</legend>
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
        <div
          className={
            view === "grid"
              ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
              : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {visible.map((item) => (
            <ItemCard key={itemKey(item)} item={item} view={view} onSelect={setSelectedItem} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Предметы не найдены. Измените запрос или выберите другую категорию.
        </div>
      )}

      <footer className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-muted-foreground text-sm">
          Найдено {filtered.length.toLocaleString("ru-RU")} {pluralItems(filtered.length)}
        </p>
        {pageCount > 1 && (
          <nav className="flex items-center gap-2" aria-label="Страницы каталога">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              <ChevronLeft data-icon="inline-start" /> Назад
            </Button>
            <span className="text-muted-foreground text-sm" aria-live="polite">
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

      <p className="text-center text-muted-foreground text-xs">
        Вся информация на сайте носит ознакомительный характер и не является публичной офертой.
      </p>

      <Dialog open={selectedItem !== null} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent>
          {selectedItem &&
            (() => {
              const Icon = categoryIcons[selectedItem.category];
              return (
                <>
                  <div className="flex flex-col items-center text-center">
                    <div className="relative flex aspect-square w-full max-w-56 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-muted/70 to-muted/20">
                      {selectedItem.imageUrl ? (
                        <Image
                          src={selectedItem.imageUrl}
                          alt={selectedItem.name}
                          fill
                          sizes="224px"
                          unoptimized
                          className="object-contain p-8"
                        />
                      ) : (
                        <Icon className="size-24 text-muted-foreground/35 stroke-[1]" aria-hidden="true" />
                      )}
                    </div>
                    <DialogHeader className="mt-5 items-center">
                      <DialogTitle className="text-xl">{selectedItem.name}</DialogTitle>
                      <DialogDescription>
                        {selectedItem.name} — предмет категории «{selectedItem.category}».
                      </DialogDescription>
                    </DialogHeader>
                  </div>

                  <section className="rounded-xl border bg-muted/30 p-4" aria-labelledby="item-source-title">
                    <h3 id="item-source-title" className="font-semibold text-sm">
                      Где можно получить
                    </h3>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Получить предмет можно в разделе «{selectedItem.category}».
                    </p>
                  </section>

                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                      <dt className="text-muted-foreground">Категория</dt>
                      <dd className="font-medium">{selectedItem.category}</dd>
                    </div>
                    <div className="flex justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                      <dt className="text-muted-foreground">ID</dt>
                      <dd className="font-medium">{selectedItem.id}</dd>
                    </div>
                  </dl>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </main>
  );
}
