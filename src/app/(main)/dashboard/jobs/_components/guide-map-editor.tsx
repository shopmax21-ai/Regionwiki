"use client";

import { useId, useState, useTransition } from "react";

import { cn } from "cn";
import { Crosshair, LoaderCircle, MapPinPlus, Move, Trash2 } from "lucide-react";

import { IconPicker } from "@/app/(main)/dashboard/map/_components/place-editor";
import {
  getCategory,
  isInsideWorld,
  type MapPlace,
  placeCategories,
  type PlaceCategoryId,
} from "@/app/(main)/dashboard/map/_components/map-data";
import { MarkerBadge } from "@/app/(main)/dashboard/map/_components/place-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { listMapPlacesForGuideAction } from "../_actions";
import { JOB_LIMITS } from "../_data/jobs";
import { type EditorBlock, type EditorMapPlace, newId } from "./editor-model";
import { asCategory, GameMapLazy, GUIDE_MAP_HEIGHT } from "./guide-map";
import type { BlockActions } from "./job-block-editor";

type MapBlock = Extract<EditorBlock, { type: "map" }>;

const sameSpot = (a: { name: string; x: number; y: number }, b: { name: string; x: number; y: number }) =>
  a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
  Math.round(a.x * 100) === Math.round(b.x * 100) &&
  Math.round(a.y * 100) === Math.round(b.y * 100);

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Редактор блока «Карта»: места ставятся нажатием на карту, меняются в форме под ней
 * или берутся из общей карты штата. Иконка у каждого места своя.
 */
export function MapBody({ block, actions }: { block: MapBlock; actions: BlockActions }) {
  const fieldId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(block.places[0]?.id ?? null);
  // new — следующий щелчок по карте ставит новое место; move — переносит выбранное
  const [pick, setPick] = useState<"new" | "move" | null>(null);
  const [library, setLibrary] = useState<MapPlace[] | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  // Начальный кадр запоминается один раз: иначе карта прыгала бы при каждой постановке метки
  const [initialFit] = useState(() => block.places.map(({ x, y }) => ({ x, y })));

  const selected = block.places.find((place) => place.id === selectedId) ?? null;
  const atLimit = block.places.length >= JOB_LIMITS.mapPlaces;

  const setPlaces = (places: EditorMapPlace[]) => actions.update(block.id, { places });
  const patchPlace = (id: string, patch: Partial<EditorMapPlace>) =>
    setPlaces(block.places.map((place) => (place.id === id ? { ...place, ...patch } : place)));

  const mapPlaces: MapPlace[] = block.places.map((place) => ({
    id: place.id,
    name: place.name || "Без названия",
    x: place.x,
    y: place.y,
    category: asCategory(place.category),
    icon: place.icon || undefined,
    description: place.description || undefined,
  }));

  const handlePick = (point: { x: number; y: number }) => {
    const x = round(point.x);
    const y = round(point.y);
    if (!isInsideWorld({ x, y })) return;
    if (pick === "move" && selected) {
      patchPlace(selected.id, { x, y });
    } else if (!atLimit) {
      const place: EditorMapPlace = {
        id: newId(),
        name: `Место ${block.places.length + 1}`,
        x,
        y,
        category: "other",
        icon: "",
        description: "",
      };
      setPlaces([...block.places, place]);
      setSelectedId(place.id);
    }
    setPick(null);
  };

  const remove = (id: string) => {
    const rest = block.places.filter((place) => place.id !== id);
    setPlaces(rest);
    setSelectedId(rest[0]?.id ?? null);
    setPick(null);
  };

  const toggleLibrary = () => {
    if (library) {
      setLibrary(null);
      return;
    }
    setLibraryError(null);
    startLoading(async () => {
      try {
        const result = await listMapPlacesForGuideAction();
        if (result.ok) setLibrary(result.places);
        else setLibraryError(result.error);
      } catch {
        setLibraryError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  const addFromLibrary = (place: MapPlace) => {
    if (atLimit || block.places.some((item) => sameSpot(item, place))) return;
    const added: EditorMapPlace = {
      id: newId(),
      name: place.name,
      x: place.x,
      y: place.y,
      category: place.category,
      icon: place.icon ?? "",
      description: place.description ?? "",
    };
    setPlaces([...block.places, added]);
    setSelectedId(added.id);
  };

  const setCoordinate = (axis: "x" | "y", raw: string) => {
    if (!selected) return;
    const value = Number(raw.replace(",", "."));
    if (raw.trim() === "" || !Number.isFinite(value)) return;
    const next = { x: selected.x, y: selected.y, [axis]: value };
    if (isInsideWorld(next)) patchPlace(selected.id, { [axis]: value });
  };

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={block.title}
        maxLength={JOB_LIMITS.mapTitle}
        onChange={(event) => actions.update(block.id, { title: event.target.value })}
        placeholder="Подпись над картой, например «Где находится шахта» (необязательно)"
        aria-label="Подпись над картой"
        autoComplete="off"
      />

      <div className={cn("relative overflow-hidden rounded-xl border bg-muted", GUIDE_MAP_HEIGHT)}>
        <GameMapLazy
          embedded
          hideFullscreen
          places={mapPlaces}
          selectedId={selected?.id ?? null}
          onSelect={(id) => {
            if (id) setSelectedId(id);
          }}
          isFullscreen={false}
          onToggleFullscreen={() => {}}
          pickMode={pick !== null}
          onPick={handlePick}
          fit={initialFit.length > 0 ? initialFit : undefined}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={pick === "new" ? "default" : "outline"}
          disabled={atLimit}
          aria-pressed={pick === "new"}
          onClick={() => setPick(pick === "new" ? null : "new")}
        >
          <MapPinPlus data-icon="inline-start" />
          {pick === "new" ? "Нажмите на карту…" : "Поставить место на карте"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={toggleLibrary}>
          {loading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
          {library ? "Скрыть метки штата" : "Добавить из карты штата"}
        </Button>
      </div>

      {libraryError && (
        <p role="alert" className="text-destructive text-sm">
          {libraryError}
        </p>
      )}

      {library && (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border p-1.5">
          {library.length === 0 && <p className="p-2 text-muted-foreground text-sm">На общей карте пока нет меток.</p>}
          {library.map((place) => {
            const added = block.places.some((item) => sameSpot(item, place));
            return (
              <button
                key={place.id}
                type="button"
                disabled={added || atLimit}
                onClick={() => addFromLibrary(place)}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <MarkerBadge category={place.category} icon={place.icon} size="md" className="rounded-md" />
                <span className="min-w-0 flex-1 truncate">{place.name}</span>
                <span className="text-muted-foreground text-xs">{added ? "уже добавлено" : getCategory(place.category).label}</span>
              </button>
            );
          })}
        </div>
      )}

      {block.places.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
          Мест пока нет. Нажмите «Поставить место на карте» и щёлкните по карте или возьмите готовые метки штата.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label="Места на карте">
          {block.places.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                aria-pressed={selected?.id === place.id}
                onClick={() => setSelectedId(place.id)}
                className="flex max-w-56 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary/60 aria-pressed:bg-muted/60"
              >
                <MarkerBadge category={asCategory(place.category)} icon={place.icon} size="sm" className="rounded-full" />
                <span className="truncate">{place.name || "Без названия"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-name`}>Название места</Label>
            <Input
              id={`${fieldId}-name`}
              value={selected.name}
              maxLength={JOB_LIMITS.placeName}
              onChange={(event) => patchPlace(selected.id, { name: event.target.value })}
              placeholder="Например, Вход в шахту"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-description`}>Описание</Label>
            <Textarea
              id={`${fieldId}-description`}
              value={selected.description}
              maxLength={JOB_LIMITS.placeDescription}
              onChange={(event) => patchPlace(selected.id, { description: event.target.value })}
              placeholder="Необязательно: как пройти, что здесь делать"
              className="max-h-32 min-h-16"
            />
          </div>

          <fieldset className="flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 font-medium text-sm">Цвет и категория</legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {placeCategories.map((category) => {
                const Icon = category.icon;
                const active = selected.category === category.id;
                return (
                  <Button
                    key={category.id}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    aria-pressed={active}
                    className="justify-start gap-2"
                    onClick={() => patchPlace(selected.id, { category: category.id as PlaceCategoryId })}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="truncate">{category.label}</span>
                  </Button>
                );
              })}
            </div>
          </fieldset>

          <IconPicker
            category={asCategory(selected.category)}
            value={selected.icon}
            onChange={(icon) => patchPlace(selected.id, { icon })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-x`}>X</Label>
              <Input
                id={`${fieldId}-x`}
                key={`x-${selected.id}-${selected.x}`}
                inputMode="decimal"
                defaultValue={String(selected.x)}
                onChange={(event) => setCoordinate("x", event.target.value)}
                autoComplete="off"
                className="tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-y`}>Y</Label>
              <Input
                id={`${fieldId}-y`}
                key={`y-${selected.id}-${selected.y}`}
                inputMode="decimal"
                defaultValue={String(selected.y)}
                onChange={(event) => setCoordinate("y", event.target.value)}
                autoComplete="off"
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={pick === "move" ? "default" : "outline"}
              aria-pressed={pick === "move"}
              onClick={() => setPick(pick === "move" ? null : "move")}
            >
              {pick === "move" ? <Crosshair data-icon="inline-start" /> : <Move data-icon="inline-start" />}
              {pick === "move" ? "Нажмите на карту…" : "Переставить на карте"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => remove(selected.id)}
            >
              <Trash2 data-icon="inline-start" /> Убрать место
            </Button>
          </div>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        До {JOB_LIMITS.mapPlaces} мест. Посетители гайда смогут двигать и масштабировать карту, а по нажатию на место увидят
        его описание.
      </p>
    </div>
  );
}
