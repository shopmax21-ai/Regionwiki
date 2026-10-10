"use client";

import { useMemo } from "react";

import { cn } from "cn";

import { getZoneKind, type MapZone, zoneKinds } from "./zone-data";

interface ZonesListProps {
  zones: MapZone[];
  query: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

/** Зоны, сгруппированные по видам: цветная точка вида и список названий. */
export function ZonesList({ zones, query, selectedId, onSelect, className }: ZonesListProps) {
  const groups = useMemo(
    () =>
      zoneKinds
        .map((kind) => ({ kind, zones: zones.filter((zone) => zone.kind === kind.id) }))
        .filter((group) => group.zones.length > 0),
    [zones],
  );

  if (groups.length === 0) {
    return (
      <p className={cn("px-4 py-6 text-center text-muted-foreground text-sm", className)}>
        {query.trim() ? "Ничего не найдено" : "Зон пока нет"}
      </p>
    );
  }

  return (
    <ul className={cn("flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-2", className)}>
      {groups.map(({ kind, zones: items }) => (
        <li key={kind.id}>
          <h3 className="flex items-center gap-2 px-2 pb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            <span aria-hidden="true" className={cn("size-2 rounded-full", kind.dotClass)} />
            {kind.label}
          </h3>
          <ul className="flex flex-col gap-0.5">
            {items.map((zone) => (
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
                  <span
                    aria-hidden="true"
                    className={cn("size-3 shrink-0 rounded-sm", getZoneKind(zone.kind).dotClass)}
                  />
                  <span className="truncate font-medium">{zone.name}</span>
                </button>
              </li>
            ))}
          </ul>
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
