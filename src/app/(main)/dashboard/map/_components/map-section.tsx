"use client";

import { useMemo, useState } from "react";

import dynamic from "next/dynamic";

import { cn } from "cn";
import { List } from "lucide-react";

import { PlaceCard } from "@/app/(main)/dashboard/map/_components/place-card";
import { PlacesPanel } from "@/app/(main)/dashboard/map/_components/places-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";

import { mapPlaces, type PlaceCategoryId, placeCategories } from "./map-data";

// Leaflet работает только в браузере
const GameMap = dynamic(() => import("@/app/(main)/dashboard/map/_components/game-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

type CategoryFilter = PlaceCategoryId | "all";

function CategoryChips({
  value,
  onChange,
  className,
}: {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
  className?: string;
}) {
  const chips: { id: CategoryFilter; label: string }[] = [
    { id: "all", label: "Все" },
    ...placeCategories.map(({ id, label }) => ({ id, label })),
  ];

  return (
    <fieldset
      aria-label="Категории"
      className={cn("flex min-w-0 gap-2 overflow-x-auto border-0 p-0 [scrollbar-width:none]", className)}
    >
      {chips.map((chip) => (
        <Button
          key={chip.id}
          variant={value === chip.id ? "default" : "outline"}
          aria-pressed={value === chip.id}
          className={cn(
            "h-11 shrink-0 px-4 shadow-sm md:h-9",
            value !== chip.id && "bg-card/90 backdrop-blur",
          )}
          onClick={() => onChange(chip.id)}
        >
          {chip.label}
        </Button>
      ))}
    </fieldset>
  );
}

export function MapSection() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const places = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return mapPlaces.filter(
      (place) => (category === "all" || place.category === category) && place.name.toLowerCase().includes(normalized),
    );
  }, [query, category]);

  const selected = places.find((place) => place.id === selectedId) ?? null;

  const handleSelectFromList = (id: string) => {
    setSelectedId(id);
    setListOpen(false);
  };

  return (
    <section
      data-content-padding="false"
      aria-label="Карта штата"
      className="relative h-[calc(100dvh-var(--dashboard-header-height))] min-h-96 overflow-hidden bg-muted"
    >
      <h1 className="sr-only">Карта штата Region</h1>

      <GameMap places={places} selectedId={selected?.id ?? null} onSelect={setSelectedId} />

      {/* Десктоп: боковая панель */}
      <aside className="absolute top-4 bottom-4 left-4 z-10 hidden w-80 flex-col gap-3 rounded-xl bg-card/95 py-4 shadow-sm ring-1 ring-foreground/10 backdrop-blur md:flex">
        <div className="flex flex-col gap-3 px-4">
          <div>
            <h2 className="font-medium text-lg leading-none tracking-tight">Карта штата</h2>
            <p className="mt-1 text-muted-foreground text-sm">Важные места и полезные адреса</p>
          </div>
          <CategoryChips value={category} onChange={setCategory} className="-mx-1 px-1 pb-1" />
        </div>
        <PlacesPanel
          places={places}
          query={query}
          onQueryChange={setQuery}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          className="flex-1"
        />
      </aside>

      {/* Телефон: кнопка списка и категории сверху */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-3 md:hidden">
        <Button
          variant="outline"
          className="h-11 shrink-0 gap-2 bg-card/90 px-4 shadow-sm backdrop-blur"
          onClick={() => setListOpen(true)}
        >
          <List className="size-4" />
          Места
          <Badge variant="secondary">{places.length}</Badge>
        </Button>
        <CategoryChips value={category} onChange={setCategory} className="-mr-3 min-w-0 pr-3" />
      </div>

      {selected && <PlaceCard key={selected.id} place={selected} onClose={() => setSelectedId(null)} />}

      <Drawer open={listOpen} onOpenChange={setListOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Места на карте</DrawerTitle>
            <DrawerDescription>Выберите место, чтобы показать его на карте</DrawerDescription>
          </DrawerHeader>
          <PlacesPanel
            places={places}
            query={query}
            onQueryChange={setQuery}
            selectedId={selected?.id ?? null}
            onSelect={handleSelectFromList}
            className="max-h-[calc(80vh-6rem)]"
          />
        </DrawerContent>
      </Drawer>
    </section>
  );
}
