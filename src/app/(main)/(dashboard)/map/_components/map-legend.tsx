"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { type MapPlace, type PlaceCategory, type PlaceCategoryId, placeCategories } from "./map-data";
import { MapTip } from "./map-tip";
import { MarkerBadge } from "./place-icons";

interface LegendRowProps {
  category: PlaceCategory;
  places: MapPlace[];
  selectedId: string | null;
  /** Номер метки, на которой остановилась стрелка, пока в этой группе ничего не выбрано */
  cursor: number;
  onCursorChange: (index: number) => void;
  onSelect: (id: string) => void;
}

/** Одна строка обозначений: значок, название группы и счётчик «2/7» со стрелками по меткам группы. */
function LegendRow({ category, places, selectedId, cursor, onCursorChange, onSelect }: LegendRowProps) {
  const count = places.length;
  const selectedIndex = places.findIndex((place) => place.id === selectedId);
  const active = selectedIndex >= 0;
  const index = active ? selectedIndex : Math.min(cursor, count - 1);
  const current = places[index];
  const single = count < 2;

  const step = (delta: number) => {
    const next = (index + delta + count) % count;
    onCursorChange(next);
    onSelect(places[next].id);
  };

  return (
    <li>
      <div
        className={cn(
          "flex min-h-11 items-center gap-1 rounded-lg pr-1 transition-colors md:min-h-9",
          active ? "bg-muted" : "hover:bg-muted/60",
        )}
      >
        <MapTip label={`Показать на карте: ${current.name}`} side="left">
          <button
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(current.id)}
            className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch rounded-lg px-2 py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <MarkerBadge category={category.id} size="sm" className="rounded-md" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-xs">{category.label}</span>
              {active && (
                <span className="truncate text-[11px] text-muted-foreground leading-tight">{current.name}</span>
              )}
            </span>
          </button>
        </MapTip>

        <div className="flex shrink-0 items-center text-muted-foreground">
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-9 md:size-6"
            disabled={single}
            aria-label={`Предыдущая метка: ${category.label}`}
            onClick={() => step(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="min-w-9 text-center text-xs tabular-nums">
            {index + 1}/{count}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-9 md:size-6"
            disabled={single}
            aria-label={`Следующая метка: ${category.label}`}
            onClick={() => step(1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  );
}

interface LegendListProps {
  places: MapPlace[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

/** Содержимое обозначений: поиск и метки карты, сгруппированные по категориям. */
export function LegendList({ places, query, onQueryChange, selectedId, onSelect, className }: LegendListProps) {
  const [cursors, setCursors] = useState<Partial<Record<PlaceCategoryId, number>>>({});

  const groups = useMemo(
    () =>
      placeCategories
        .map((category) => ({ category, places: places.filter((place) => place.category === category.id) }))
        .filter((group) => group.places.length > 0),
    [places],
  );

  return (
    <div className={cn("flex min-h-0 flex-col gap-2 pt-3", className)}>
      <div className="relative px-3">
        <Search className="pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Найти метку"
          aria-label="Поиск по меткам на карте"
          data-section-search
          className="h-11 pl-9 text-base md:h-9 md:text-sm"
        />
      </div>

      <h3 className="px-4 pt-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">Метки</h3>

      {groups.length === 0 ? (
        <p className="px-4 pt-2 pb-6 text-center text-muted-foreground text-sm">Ничего не найдено</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {groups.map((group) => (
            <LegendRow
              key={group.category.id}
              category={group.category}
              places={group.places}
              selectedId={selectedId}
              cursor={cursors[group.category.id] ?? 0}
              onCursorChange={(index) => setCursors((current) => ({ ...current, [group.category.id]: index }))}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface MapLegendProps extends Omit<LegendListProps, "className"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

/** Сворачиваемый блок «Условные обозначения» в углу карты (на телефоне те же метки открываются списком снизу). */
export function MapLegend({ open, onOpenChange, className, ...list }: MapLegendProps) {
  return (
    <section
      aria-label="Условные обозначения"
      className={cn(
        "hidden shrink-0 flex-col overflow-hidden rounded-xl bg-card/95 shadow-sm ring-1 ring-foreground/10 backdrop-blur md:flex",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex h-12 w-full shrink-0 items-center justify-between gap-2 px-4 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="font-medium text-xs uppercase tracking-wider">Условные обозначения</span>
        <span className="flex items-center gap-2">
          {/* Поиск продолжает фильтровать карту, даже когда блок свёрнут: напоминаем об этом точкой */}
          {!open && list.query.trim() !== "" && (
            <>
              <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
              <span className="sr-only">Задан поиск по меткам</span>
            </>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 text-muted-foreground transition-transform", !open && "rotate-180")}
          />
        </span>
      </button>

      {open && <LegendList {...list} className="max-h-[min(24rem,45dvh)] border-t" />}
    </section>
  );
}
