"use client";

import { useMemo, useState } from "react";

import dynamic from "next/dynamic";

import { cn } from "cn";
import { Check, Copy, MapPin, X } from "lucide-react";

import type { FocusRequest } from "@/app/(main)/dashboard/map/_components/game-map";
import {
  getCategory,
  type MapPlace,
  type PlaceCategoryId,
  placeCategoryIds,
} from "@/app/(main)/dashboard/map/_components/map-data";
import { MarkerBadge } from "@/app/(main)/dashboard/map/_components/place-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { GuideMapPlace } from "../_data/jobs";

// Карта работает только в браузере
export const GameMapLazy = dynamic(() => import("@/app/(main)/dashboard/map/_components/game-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

export const asCategory = (value: string): PlaceCategoryId =>
  placeCategoryIds.find((id) => id === value) ?? "other";

/** Места гайда в том виде, в каком их ждёт карта: у каждого есть id (порядковый номер). */
export const toMapPlaces = (places: readonly GuideMapPlace[]): MapPlace[] =>
  places.map((place, index) => ({
    id: String(index),
    name: place.name,
    x: place.x,
    y: place.y,
    category: asCategory(place.category),
    icon: place.icon,
    description: place.description,
  }));

/** Высота окна карты внутри гайда: на телефоне ниже, чтобы страницу можно было листать мимо карты. */
export const GUIDE_MAP_HEIGHT = "h-72 sm:h-96";

/**
 * Интерактивная карта с местами из гайда. При открытии подбирает масштаб так, чтобы все места были в кадре.
 * Список под картой дублирует метки: по нажатию карта приближается к месту и показывает его описание.
 */
export function GuideMap({ title, places }: { title?: string; places: readonly GuideMapPlace[] }) {
  const mapPlaces = useMemo(() => toMapPlaces(places), [places]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [copied, setCopied] = useState(false);

  const selected = mapPlaces.find((place) => place.id === selectedId) ?? null;

  const choose = (id: string | null, zoomTo = false) => {
    setSelectedId(id);
    setCopied(false);
    if (id !== null && zoomTo) setFocus((current) => ({ id, n: (current?.n ?? 0) + 1 }));
  };

  const copy = async (place: MapPlace) => {
    try {
      await navigator.clipboard.writeText(`${Math.round(place.x)}, ${Math.round(place.y)}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен: координаты остаются видны в карточке
    }
  };

  return (
    <figure className="flex min-w-0 flex-col gap-2">
      {title && <figcaption className="font-medium">{title}</figcaption>}

      <div className={cn("relative overflow-hidden rounded-xl border bg-muted", GUIDE_MAP_HEIGHT)}>
        <GameMapLazy
          embedded
          places={mapPlaces}
          selectedId={selected?.id ?? null}
          onSelect={(id) => choose(id)}
          isFullscreen={false}
          onToggleFullscreen={() => {}}
          fit={places}
          focus={focus}
          hideFullscreen
        />

        {selected && (
          <div className="absolute inset-x-2 bottom-2 z-10 flex flex-col gap-2 rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur sm:right-auto sm:w-72">
            <div className="flex items-start gap-3">
              <MarkerBadge category={selected.category} icon={selected.icon} size="lg" className="rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="font-medium leading-tight">{selected.name}</p>
                <Badge variant="secondary" className="w-fit">
                  {getCategory(selected.category).label}
                </Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Закрыть описание места"
                onClick={() => choose(null)}
              >
                <X />
              </Button>
            </div>
            {selected.description && (
              <p className="whitespace-pre-line text-muted-foreground text-xs leading-5">{selected.description}</p>
            )}
            <Button type="button" variant="outline" size="sm" className="justify-between" onClick={() => copy(selected)}>
              <span className="text-muted-foreground">Координаты</span>
              <span className="flex items-center gap-2 tabular-nums">
                {copied ? "Скопировано" : `${Math.round(selected.x)}, ${Math.round(selected.y)}`}
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </span>
            </Button>
          </div>
        )}
      </div>

      {places.length > 1 && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {mapPlaces.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                aria-pressed={selected?.id === place.id}
                onClick={() => choose(place.id, true)}
                className="flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary/50 aria-pressed:bg-muted/50"
              >
                <MarkerBadge category={place.category} icon={place.icon} size="md" className="rounded-md" />
                <span className="min-w-0 flex-1 truncate">{place.name}</span>
                <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-xs">Перетаскивайте карту, масштаб — кнопками или Ctrl + колесо мыши.</p>
    </figure>
  );
}
