"use client";

import { cn } from "cn";

import { getZoneColor, type MapZone } from "./zone-data";

interface ZonesListProps {
  zones: MapZone[];
  query: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

/** Список зон: цветная точка и название. */
export function ZonesList({ zones, query, selectedId, onSelect, className }: ZonesListProps) {
  if (zones.length === 0) {
    return (
      <p className={cn("px-4 py-6 text-center text-muted-foreground text-sm", className)}>
        {query.trim() ? "Ничего не найдено" : "Зон пока нет"}
      </p>
    );
  }

  return (
    <ul className={cn("flex min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2", className)}>
      {zones.map((zone) => (
        <li key={zone.id}>
          <button
            type="button"
            aria-pressed={selectedId === zone.id}
            onClick={() => onSelect(zone.id)}
            className={cn(
              "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9 md:text-xs",
              selectedId === zone.id ? "bg-muted" : "hover:bg-muted/60",
            )}
          >
            <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-sm", getZoneColor(zone.color).dotClass)} />
            <span className="truncate font-medium">{zone.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Блок «Игровые зоны» в правом углу карты (на телефоне те же зоны открываются списком снизу). */
export function ZonesPanel(props: Omit<ZonesListProps, "className">) {
  return (
    <section
      aria-label="Игровые зоны"
      className="hidden shrink-0 flex-col overflow-hidden rounded-xl bg-card/95 shadow-sm ring-1 ring-foreground/10 backdrop-blur md:flex"
    >
      <h2 className="flex h-12 shrink-0 items-center px-4 font-medium text-xs uppercase tracking-wider">
        Игровые зоны
      </h2>
      <ZonesList {...props} className="max-h-[min(24rem,45dvh)] border-t" />
    </section>
  );
}
