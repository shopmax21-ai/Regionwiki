"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight, Funnel, Plus, Search, Sparkles } from "lucide-react";

import { FilterDropdown } from "@/app/(main)/dashboard/_components/filter-dropdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import {
  type Category,
  categories,
  compareByCategory,
  type Item,
  type ItemCategory,
  itemKey,
  pluralItems,
} from "../_data/items";
import { ItemCard } from "./item-card";
import { ItemDeleteDialog } from "./item-delete-dialog";
import { ItemDetailsDialog } from "./item-details-dialog";
import { ItemEditor } from "./item-editor";

const PAGE_SIZE = 48;

const sortOptions = [
  { id: "new", label: "Сначала новые" },
  { id: "old", label: "Сначала старые" },
  { id: "name", label: "По названию (А–Я)" },
] as const;

type SortId = (typeof sortOptions)[number]["id"];

/** off — не администратор, on — можно редактировать, unavailable — права есть, но базы данных нет */
export type EditorMode = "off" | "on" | "unavailable";

/** Окно редактора: новый предмет или правка существующего */
type EditorTarget = { mode: "create" } | { mode: "edit"; item: Item };

type ItemsWikiProps = { items: Item[]; initialQuery?: string; editor?: EditorMode };

export function ItemsWiki({ items, initialQuery = "", editor = "off" }: ItemsWikiProps) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<Category>("Все");
  const [sort, setSort] = useState<SortId>("new");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Item | null>(null);
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);

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
  }, [category, items, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-col items-center gap-3 py-4 text-center md:py-6">
        <h1 className="font-semibold text-3xl tracking-tight md:text-5xl">Таблица предметов</h1>
        <p className="max-w-xl text-muted-foreground text-sm md:text-base">
          Продукты, инструменты, материалы, одежда и другие предметы проекта
        </p>
        {editor === "on" && (
          <Button size="sm" onClick={() => setEditing({ mode: "create" })}>
            <Plus data-icon="inline-start" /> Добавить предмет
          </Button>
        )}
        {editor === "unavailable" && (
          <p role="status" className="max-w-xl rounded-lg border border-dashed px-3 py-2 text-muted-foreground text-xs">
            База данных недоступна: показаны встроенные данные, добавление и редактирование отключены.
          </p>
        )}
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {visible.map((item) => (
            <ItemCard key={itemKey(item)} item={item} onOpen={setSelected} />
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

      <ItemDetailsDialog
        item={selected}
        canEdit={editor === "on"}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onEdit={(item) => {
          setSelected(null);
          setEditing({ mode: "edit", item });
        }}
        onDelete={(item) => {
          setSelected(null);
          setDeleting(item);
        }}
      />

      {editing && (
        <ItemEditor
          key={editing.mode === "edit" ? editing.item.id : "new"}
          item={editing.mode === "edit" ? editing.item : undefined}
          defaultCategory={category === "Все" ? undefined : (category as ItemCategory)}
          onClose={() => setEditing(null)}
        />
      )}

      <ItemDeleteDialog item={deleting} onClose={() => setDeleting(null)} />
    </main>
  );
}
