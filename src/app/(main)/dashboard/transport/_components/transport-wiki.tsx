"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight, CircleDollarSign, Funnel, LayoutGrid, Rows2, Search, Sparkles } from "lucide-react";

import { FilterDropdown } from "@/app/(main)/dashboard/_components/filter-dropdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { type Category, categories, type Vehicle } from "../_data/vehicles";
import { type PriceRange, PriceRangeFilter } from "./price-range-filter";
import { VehicleCard } from "./vehicle-card";
import { VehicleEditor } from "./vehicle-editor";
import { VehicleRow } from "./vehicle-row";

const PAGE_SIZE = 12;

const sortOptions = [
  { id: "new", label: "Сначала новые" },
  { id: "expensive", label: "Сначала дорогие" },
  { id: "cheap", label: "Сначала дешёвые" },
  { id: "speed", label: "По скорости" },
] as const;

const ALL_SOURCES = "all";

type SortId = (typeof sortOptions)[number]["id"];
type ViewMode = "grid" | "list";

export type EditorMode = "off" | "on" | "unavailable";

export function TransportWiki({ vehicles, editor = "off" }: { vehicles: Vehicle[]; editor?: EditorMode }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("Все");
  const [customRange, setPriceRange] = useState<PriceRange | null>(null);
  const [sort, setSort] = useState<SortId>("new");
  const [source, setSource] = useState<string>(ALL_SOURCES);
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

  const priceBounds = useMemo<PriceRange>(
    () =>
      vehicles.length > 0
        ? [Math.min(...vehicles.map((vehicle) => vehicle.price)), Math.max(...vehicles.map((vehicle) => vehicle.price))]
        : [0, 0],
    [vehicles],
  );
  const priceRange = customRange ?? priceBounds;

  const sourceOptions = useMemo(
    () => [
      { id: ALL_SOURCES, label: "Все источники" },
      ...Array.from(new Set(vehicles.flatMap((vehicle) => vehicle.sources))).map((source) => ({
        id: source,
        label: source,
      })),
    ],
    [vehicles],
  );

  const filteredVehicles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return vehicles
      .filter((vehicle) => {
        const matchesCategory = category === "Все" || vehicle.category === category;
        const matchesPrice = vehicle.price >= priceRange[0] && vehicle.price <= priceRange[1];
        const matchesSource = source === ALL_SOURCES || vehicle.sources.includes(source);
        const haystack = `${vehicle.name} ${vehicle.model} ${vehicle.code}`.toLowerCase();
        return matchesCategory && matchesPrice && matchesSource && haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sort === "expensive") return b.price - a.price;
        if (sort === "cheap") return a.price - b.price;
        if (sort === "speed") return b.speed - a.speed;
        return Number(b.isNew ?? false) - Number(a.isNew ?? false);
      });
  }, [category, priceRange, query, sort, source, vehicles]);

  const pageCount = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleVehicles = filteredVehicles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-col items-center gap-3 py-4 text-center md:py-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Таблица транспорта</h1>
        <p className="max-w-xl text-sm text-muted-foreground md:text-base">
          Подробные характеристики автомобилей и другой техники
        </p>
        {editor === "on" && <VehicleEditor mode="create" />}
        {editor === "unavailable" && (
          <p role="status" className="max-w-xl rounded-lg border border-dashed px-3 py-2 text-muted-foreground text-xs">
            База данных недоступна: показаны встроенные данные, добавление и редактирование отключены.
          </p>
        )}
      </header>

      <section className="flex flex-col gap-3" aria-label="Фильтры транспорта">
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
              placeholder="Поиск транспорта..."
              aria-label="Поиск транспорта"
              className="h-10 pl-9"
            />
          </div>

          <Separator orientation="vertical" className="hidden h-6 data-vertical:self-center lg:block" />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={view === "list" ? "secondary" : "outline"}
              size="icon"
              className="size-10"
              aria-pressed={view === "list"}
              aria-label={view === "list" ? "Показать карточками" : "Показать списком"}
              onClick={() => setView(view === "list" ? "grid" : "list")}
            >
              {view === "list" ? <LayoutGrid className="size-4" /> : <Rows2 className="size-4" />}
            </Button>
            <FilterDropdown
              icon={CircleDollarSign}
              label="Источник"
              value={source}
              options={sourceOptions}
              onChange={(value) => {
                setSource(value);
                setPage(1);
              }}
              className="max-sm:flex-1"
            />
            <PriceRangeFilter
              min={priceBounds[0]}
              max={priceBounds[1]}
              value={priceRange}
              onChange={(value) => {
                setPriceRange(value);
                setPage(1);
              }}
              className="max-sm:flex-1"
            />
            <FilterDropdown
              icon={Funnel}
              label="Сортировка"
              value={sort}
              options={sortOptions}
              onChange={(value) => {
                setSort(value);
                setPage(1);
              }}
              className="max-sm:flex-1"
            />
          </div>
        </div>

        <fieldset className="m-0 flex min-w-0 gap-2 overflow-x-auto border-0 p-0 pb-1">
          <legend className="sr-only">Категории транспорта</legend>
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

      {visibleVehicles.length > 0 ? (
        view === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleVehicles.map((vehicle) => (
              <VehicleCard key={vehicle.code} vehicle={vehicle} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleVehicles.map((vehicle) => (
              <VehicleRow key={vehicle.code} vehicle={vehicle} />
            ))}
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Транспорт не найден. Измените запрос или выберите другую категорию.
        </div>
      )}

      <footer className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          Найдено {filteredVehicles.length.toLocaleString("ru-RU")} из {vehicles.length.toLocaleString("ru-RU")} единиц
          транспорта
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
    </main>
  );
}
