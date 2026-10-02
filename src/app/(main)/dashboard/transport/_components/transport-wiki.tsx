"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { type Category, categories, vehicles } from "../_data/vehicles";
import { VehicleCard } from "./vehicle-card";

const PAGE_SIZE = 12;

const priceRanges = [
  { id: "any", label: "Любая цена", min: 0, max: Number.POSITIVE_INFINITY },
  { id: "1", label: "До $1 000 000", min: 0, max: 1_000_000 },
  { id: "2", label: "$1 000 000 – $5 000 000", min: 1_000_000, max: 5_000_000 },
  { id: "3", label: "$5 000 000 – $10 000 000", min: 5_000_000, max: 10_000_000 },
  { id: "4", label: "От $10 000 000", min: 10_000_000, max: Number.POSITIVE_INFINITY },
] as const;

const sortOptions = [
  { id: "new", label: "Сначала новые" },
  { id: "expensive", label: "Сначала дорогие" },
  { id: "cheap", label: "Сначала дешёвые" },
  { id: "speed", label: "По скорости" },
] as const;

type PriceId = (typeof priceRanges)[number]["id"];
type SortId = (typeof sortOptions)[number]["id"];

export function TransportWiki() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("Все");
  const [priceId, setPriceId] = useState<PriceId>("any");
  const [sort, setSort] = useState<SortId>("new");
  const [page, setPage] = useState(1);

  const filteredVehicles = useMemo(() => {
    const range = priceRanges.find((item) => item.id === priceId) ?? priceRanges[0];
    const normalizedQuery = query.trim().toLowerCase();

    return vehicles
      .filter((vehicle) => {
        const matchesCategory = category === "Все" || vehicle.category === category;
        const matchesPrice = vehicle.price >= range.min && vehicle.price < range.max;
        const haystack = `${vehicle.name} ${vehicle.model} ${vehicle.code}`.toLowerCase();
        return matchesCategory && matchesPrice && haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sort === "expensive") return b.price - a.price;
        if (sort === "cheap") return a.price - b.price;
        if (sort === "speed") return b.speed - a.speed;
        return Number(b.isNew ?? false) - Number(a.isNew ?? false);
      });
  }, [category, priceId, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleVehicles = filteredVehicles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-col items-center gap-3 py-4 text-center md:py-6">
        <Badge variant="secondary" className="gap-2 rounded-full px-3 py-1">
          <Sparkles data-icon="inline-start" /> Region Wiki
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Таблица транспорта</h1>
        <p className="max-w-xl text-sm text-muted-foreground md:text-base">
          Подробные характеристики автомобилей и другой техники в штате
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-label="Фильтры транспорта">
        <div className="flex flex-col gap-3 lg:flex-row">
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
          <div className="flex flex-wrap gap-2">
            <NativeSelect
              aria-label="Диапазон цены"
              value={priceId}
              onChange={(event) => {
                setPriceId(event.target.value as PriceId);
                setPage(1);
              }}
              className="max-sm:w-full"
            >
              {priceRanges.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Сортировка"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortId);
                setPage(1);
              }}
              className="max-sm:w-full"
            >
              {sortOptions.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleVehicles.map((vehicle) => (
            <VehicleCard key={vehicle.code} vehicle={vehicle} />
          ))}
        </div>
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
