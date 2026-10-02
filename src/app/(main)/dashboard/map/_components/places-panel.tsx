"use client";

import { cn } from "cn";
import { MapPin, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { getCategory, type MapPlace } from "./map-data";

interface PlacesPanelProps {
  places: MapPlace[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

export function PlacesPanel({ places, query, onQueryChange, selectedId, onSelect, className }: PlacesPanelProps) {
  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="relative px-4">
        <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Найти место"
          aria-label="Поиск по местам на карте"
          className="h-11 rounded-xl pl-9 text-base md:text-sm"
        />
      </div>

      {places.length === 0 ? (
        <p className="px-4 py-8 text-center text-muted-foreground text-sm">Ничего не найдено</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {places.map((place) => {
            const category = getCategory(place.category);
            const Icon = category.icon;
            return (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => onSelect(place.id)}
                  aria-pressed={selectedId === place.id}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors",
                    "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-muted",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium text-sm">{place.name}</span>
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      <MapPin className="size-3" />
                      {Math.round(place.x)}, {Math.round(place.y)}
                    </span>
                  </span>
                  <Badge variant="secondary">{category.label}</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
