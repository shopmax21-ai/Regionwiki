"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import dynamic from "next/dynamic";

import { cn } from "cn";
import { Check, ChevronDown, Layers, List, Plus, Search, Upload, X } from "lucide-react";

import { LegendList, MapLegend } from "@/app/(main)/(dashboard)/map/_components/map-legend";
import { PlaceCard } from "@/app/(main)/(dashboard)/map/_components/place-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { createPlaceAction, updatePlaceAction } from "../_actions";
import type { DraftMarker, FocusRequest } from "./game-map";
import { isInsideWorld, type MapPlace } from "./map-data";
import { MapTip, MapTipContainer } from "./map-tip";
import { type PlaceDraft, PlaceEditor } from "./place-editor";
import { PlaceImport } from "./place-import";
import { zones as allZones, zoneCenter } from "./zone-data";
import { ZonesList, ZonesPanel } from "./zones-panel";

// Карта работает только в браузере
const GameMap = dynamic(() => import("@/app/(main)/(dashboard)/map/_components/game-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

/** world — обычная карта мира с метками; zones — та же карта с контурами игровых зон */
type MapMode = "world" | "zones";

const MAP_MODES: { id: MapMode; label: string }[] = [
  { id: "world", label: "Карта мира" },
  { id: "zones", label: "Карта игровых зон" },
];

/** off — обычный режим; native — нативный полноэкранный режим браузера; css — запасной вариант для iPhone и т. п. */
type FullscreenMode = "off" | "native" | "css";

interface MapSectionProps {
  places: MapPlace[];
  /** on — можно редактировать; unavailable — право есть, но база недоступна; off — права нет */
  editor: "on" | "off" | "unavailable";
  problem: string | null;
  /** Место, на которое ведёт ссылка с другой страницы (например, «На карте» у бизнеса) */
  linked?: LinkedPlace | null;
}

/** Временная метка по ссылке: показывается на карте, пока её не закроют. */
export interface LinkedPlace {
  x: number;
  y: number;
  name: string;
}

/** Запоминается, открыт ли блок «Условные обозначения». */
const LEGEND_STORAGE_KEY = "region-map-legend-open";

/**
 * Выбор карты. Список раскрывается внутри раздела карты, а не в портале: в полноэкранном режиме браузер
 * показывает только сам раздел, и меню из портала в нём не было бы видно.
 */
function MapSwitcher({
  value,
  onChange,
  className,
}: {
  value: MapMode;
  onChange: (value: MapMode) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = MAP_MODES.find((item) => item.id === value) ?? MAP_MODES[0];

  // Закрываем по клику вне списка и по Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Выбрать карту"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          className,
          "flex h-12 min-w-44 items-center gap-3 px-4 font-medium text-sm outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
      >
        <Layers aria-hidden="true" className="size-5 shrink-0" />
        <span className="flex-1 text-left">{current.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Карта"
          className="absolute top-full left-0 z-20 mt-1 w-max min-w-full rounded-xl bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {MAP_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === value}
              onClick={() => {
                onChange(item.id);
                setOpen(false);
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted md:min-h-9"
            >
              <span className="flex-1">{item.label}</span>
              {item.id === value && <Check aria-hidden="true" className="size-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const parseCoordinate = (value: string): number | null => {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCoordinate = (value: number) => String(Math.round(value * 100) / 100);

export function MapSection({ places: allPlaces, editor, problem, linked = null }: MapSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  // Подсказки рисуются внутри раздела, иначе в полноэкранном режиме их не было бы видно
  const [tipContainer, setTipContainer] = useState<HTMLElement | null>(null);
  useEffect(() => setTipContainer(sectionRef.current), []);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<MapMode>("world");
  const [showMarkers, setShowMarkers] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [linkedPlace, setLinkedPlace] = useState<LinkedPlace | null>(linked);
  // Если пришли по ссылке, карта сразу приближается к этому месту
  const [focus, setFocus] = useState<FocusRequest | null>(
    linked ? { id: "linked", n: 1, point: { x: linked.x, y: linked.y } } : null,
  );
  const [fullscreen, setFullscreen] = useState<FullscreenMode>("off");
  const [draft, setDraft] = useState<PlaceDraft | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const canEdit = editor === "on";

  // Метка, которую сейчас правят, рисуется отдельно (в новой позиции), поэтому из общего набора её убираем.
  // Если «Стандартные метки» выключены, на карте нет ни меток, ни их списка.
  const visiblePlaces = useMemo(() => {
    if (!showMarkers) return [];
    const normalized = query.trim().toLowerCase();
    return allPlaces.filter((place) => place.id !== draft?.id && place.name.toLowerCase().includes(normalized));
  }, [allPlaces, query, showMarkers, draft?.id]);

  const visibleZones = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allZones.filter((zone) => zone.name.toLowerCase().includes(normalized));
  }, [query]);

  const selected = visiblePlaces.find((place) => place.id === selectedId) ?? null;

  const draftMarker = useMemo<DraftMarker | null>(() => {
    if (!draft) return null;
    const x = parseCoordinate(draft.x);
    const y = parseCoordinate(draft.y);
    if (x === null || y === null || !isInsideWorld({ x, y })) return null;
    return { x, y, category: draft.category, icon: draft.icon || undefined };
  }, [draft]);

  const focusPlace = (id: string, point?: { x: number; y: number }) =>
    setFocus((current) => ({ id, n: (current?.n ?? 0) + 1, point }));

  const handleSelectFromList = (id: string) => {
    setSelectedId(id);
    focusPlace(id);
    setListOpen(false);
  };

  const handleSelectZone = (id: string) => {
    const zone = allZones.find((item) => item.id === id);
    if (!zone) return;
    setSelectedZoneId(id);
    focusPlace(id, zoneCenter(zone));
    setListOpen(false);
  };

  const changeMode = (next: MapMode) => {
    setMode(next);
    setListOpen(false);
    setSelectedId(null);
    setSelectedZoneId(null);
    // Метки ставят и правят на карте мира: на карте зон редактор закрывается
    if (next === "zones") {
      setDraft(null);
      setImportOpen(false);
      setEditorError(null);
    }
  };

  const toggleSearch = () => {
    if (searchOpen) setQuery("");
    setSearchOpen(!searchOpen);
  };

  // Свёрнутая боковая панель
  useEffect(() => {
    try {
      if (window.localStorage.getItem(LEGEND_STORAGE_KEY) === "0") setLegendOpen(false);
    } catch {
      // Хранилище браузера недоступно: панель просто открывается развёрнутой
    }
  }, []);

  const changeLegendOpen = useCallback((next: boolean) => {
    setLegendOpen(next);
    try {
      window.localStorage.setItem(LEGEND_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Не страшно: выбор просто не запомнится
    }
  }, []);

  // Полноэкранный режим
  // На весь экран разворачивается весь раздел, а не только картинка: так в нём остаются боковая панель,
  // карточка метки, форма редактора и все кнопки.

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen((mode) => (mode === "native" ? "off" : mode));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // При уходе со страницы выходим из полноэкранного режима, чтобы он не «прилип» к другим разделам.
  useEffect(() => {
    const section = sectionRef.current;
    return () => {
      if (section && document.fullscreenElement === section) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // В запасном режиме страница под разделом не должна прокручиваться.
  useEffect(() => {
    if (fullscreen !== "css") return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [fullscreen]);

  const toggleFullscreen = useCallback(async () => {
    if (fullscreen !== "off") {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setFullscreen("off");
      return;
    }
    const section = sectionRef.current;
    if (!section) return;
    if (typeof section.requestFullscreen === "function") {
      try {
        await section.requestFullscreen();
        setFullscreen("native");
        return;
      } catch {
        // Браузер отказал (например, запрет политикой сайта): используем запасной режим
      }
    }
    setFullscreen("css");
  }, [fullscreen]);

  // Редактор меток
  const startCreate = () => {
    setShowMarkers(true);
    setSelectedId(null);
    setListOpen(false);
    setImportOpen(false);
    setEditorError(null);
    setDraft({
      id: null,
      name: "",
      category: "other",
      description: "",
      icon: "",
      x: "",
      y: "",
    });
  };

  const startImport = () => {
    setShowMarkers(true);
    setSelectedId(null);
    setListOpen(false);
    setDraft(null);
    setEditorError(null);
    setImportOpen(true);
  };

  const startEdit = (place: MapPlace) => {
    setImportOpen(false);
    setEditorError(null);
    setDraft({
      id: place.id,
      name: place.name,
      category: place.category,
      description: place.description ?? "",
      icon: place.icon ?? "",
      x: formatCoordinate(place.x),
      y: formatCoordinate(place.y),
    });
  };

  const cancelDraft = useCallback(() => {
    setDraft(null);
    setEditorError(null);
  }, []);

  const saveDraft = () => {
    if (!draft) return;
    setEditorError(null);
    const payload = {
      name: draft.name,
      category: draft.category,
      description: draft.description,
      icon: draft.icon,
      x: parseCoordinate(draft.x) ?? undefined,
      y: parseCoordinate(draft.y) ?? undefined,
    };
    startSaving(async () => {
      try {
        const result = draft.id ? await updatePlaceAction(draft.id, payload) : await createPlaceAction(payload);
        if (!result.ok) {
          setEditorError(result.error);
          return;
        }
        // Фильтры могли бы спрятать сохранённую метку, поэтому сбрасываем их
        setQuery("");
        setShowMarkers(true);
        setDraft(null);
        setSelectedId(result.id);
        // Координаты известны заранее, ждать обновления списка с сервера не нужно
        focusPlace(result.id, { x: payload.x ?? 0, y: payload.y ?? 0 });
      } catch {
        setEditorError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  // Клавиша Escape: закрыть список, отменить правку или выйти из запасного полноэкранного режима.
  // В нативном полноэкранном режиме Escape обрабатывает сам браузер.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // В поле ввода Escape не должен стирать набранное
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (listOpen) setListOpen(false);
      else if (importOpen && !typing) setImportOpen(false);
      else if (draft && !saving && !typing) cancelDraft();
      else if (fullscreen === "css") setFullscreen("off");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [listOpen, importOpen, draft, saving, fullscreen, cancelDraft]);

  // Общий вид плашек панели: тёмная полупрозрачная подложка, как у остальных элементов карты
  const plate = "rounded-xl bg-card/95 shadow-sm ring-1 ring-foreground/10 backdrop-blur";
  const searchTip = mode === "world" ? "Поиск по меткам" : "Поиск по зонам";
  const listCount = mode === "world" ? visiblePlaces.length : visibleZones.length;

  return (
    <MapTipContainer value={tipContainer}>
      <section
        ref={sectionRef}
        data-content-padding="false"
        aria-label="Карта штата"
        className={cn(
          "relative overflow-hidden bg-muted",
          fullscreen === "css"
            ? "fixed inset-0 z-[100] h-dvh"
            : "h-[calc(100dvh-var(--dashboard-header-height))] min-h-96",
        )}
      >
        <h1 className="sr-only">Карта штата Region</h1>

        <GameMap
          places={visiblePlaces}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          isFullscreen={fullscreen !== "off"}
          onToggleFullscreen={toggleFullscreen}
          pickMode={draft !== null}
          onPick={(point) =>
            setDraft((current) =>
              current ? { ...current, x: formatCoordinate(point.x), y: formatCoordinate(point.y) } : current,
            )
          }
          draft={draftMarker ?? (linkedPlace ? { x: linkedPlace.x, y: linkedPlace.y, category: "other" } : null)}
          focus={focus}
          zones={mode === "zones" ? visibleZones : undefined}
          selectedZoneId={selectedZoneId}
        />

        {linkedPlace && !draft && (
          <div
            role="status"
            className="absolute top-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-card/95 py-1 pr-1 pl-4 text-sm shadow-sm ring-1 ring-foreground/10 backdrop-blur"
          >
            <span className="truncate font-medium">{linkedPlace.name}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0 rounded-full"
              aria-label="Убрать отметку с карты"
              onClick={() => setLinkedPlace(null)}
            >
              <X />
            </Button>
          </div>
        )}

        {/* Панель сверху слева: выбор карты, поиск и переключатель меток (вместо прежней боковой панели) */}
        <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-start gap-2 md:top-4 md:left-4">
          <MapSwitcher value={mode} onChange={changeMode} className={plate} />

          <MapTip label={searchOpen ? "Закрыть поиск" : searchTip} side="bottom">
            <button
              type="button"
              aria-label={searchOpen ? "Закрыть поиск" : "Открыть поиск"}
              aria-expanded={searchOpen}
              onClick={toggleSearch}
              className={cn(
                plate,
                "relative flex size-12 shrink-0 items-center justify-center outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50",
                searchOpen && "bg-card text-primary",
              )}
            >
              {searchOpen ? (
                <X aria-hidden="true" className="size-5" />
              ) : (
                <Search aria-hidden="true" className="size-5" />
              )}
            </button>
          </MapTip>

          {searchOpen && (
            <div className={cn(plate, "flex h-12 w-full items-center px-2 sm:w-64")}>
              <Input
                autoFocus
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={mode === "world" ? "Найти метку" : "Найти зону"}
                aria-label={mode === "world" ? "Поиск по меткам на карте" : "Поиск по игровым зонам"}
                data-section-search
                className="h-9 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 md:text-sm dark:bg-transparent"
              />
            </div>
          )}

          <label
            htmlFor="map-standard-markers"
            className={cn(plate, "flex h-12 cursor-pointer items-center gap-3 px-3 font-medium text-sm")}
          >
            <Checkbox
              id="map-standard-markers"
              checked={showMarkers}
              onCheckedChange={(checked) => {
                setShowMarkers(checked === true);
                if (checked !== true) setSelectedId(null);
              }}
              className="size-6 rounded-md"
            />
            Стандартные метки
          </label>

          {canEdit && mode === "world" && (
            <>
              <MapTip label="Добавить метку" side="bottom">
                <button
                  type="button"
                  aria-label="Добавить метку"
                  onClick={startCreate}
                  disabled={draft !== null}
                  className={cn(
                    plate,
                    "flex size-12 shrink-0 items-center justify-center outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  <Plus aria-hidden="true" className="size-5" />
                </button>
              </MapTip>
              <MapTip label="Загрузить метки из файла" side="bottom">
                <button
                  type="button"
                  aria-label="Загрузить метки из файла"
                  onClick={startImport}
                  disabled={draft !== null || importOpen}
                  className={cn(
                    plate,
                    "flex size-12 shrink-0 items-center justify-center outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  <Upload aria-hidden="true" className="size-5" />
                </button>
              </MapTip>
            </>
          )}

          {/* Телефон: список меток или зон открывается снизу */}
          {(mode === "zones" || showMarkers) && (
            <Button
              variant="outline"
              className={cn(plate, "h-12 shrink-0 gap-2 px-4 md:hidden")}
              onClick={() => setListOpen(true)}
            >
              <List className="size-4" />
              {mode === "world" ? "Метки" : "Зоны"}
              <Badge variant="secondary">{listCount}</Badge>
            </Button>
          )}

          {editor === "unavailable" && mode === "world" && (
            <p className={cn(plate, "max-w-80 px-3 py-2 text-muted-foreground text-xs")}>
              Редактирование карты сейчас недоступно{problem ? `: ${problem}` : ""}
            </p>
          )}
        </div>

        {/* Правая колонка: карточка метки, редактор или загрузка лежат над блоком обозначений, чтобы не перекрывать его.
          На телефоне колонка «прозрачна» (contents): карточки там сами прижаты к низу, а обозначения открываются списком. */}
        <div
          className={cn(
            "max-md:contents md:absolute md:right-4 md:bottom-4 md:z-10 md:flex md:max-h-[calc(100%-9rem)] md:flex-col md:justify-end md:gap-3",
            importOpen && canEdit ? "md:w-96" : "md:w-80",
          )}
        >
          {importOpen && canEdit && (
            <PlaceImport
              places={allPlaces}
              onClose={() => setImportOpen(false)}
              onImported={() => {
                // Поиск мог бы спрятать загруженные метки
                setQuery("");
                setShowMarkers(true);
              }}
            />
          )}

          {draft ? (
            <PlaceEditor
              draft={draft}
              onChange={(patch) => setDraft((current) => (current ? { ...current, ...patch } : current))}
              onSave={saveDraft}
              onCancel={cancelDraft}
              pending={saving}
              error={editorError}
            />
          ) : (
            selected &&
            !importOpen && (
              <PlaceCard
                key={selected.id}
                place={selected}
                onClose={() => setSelectedId(null)}
                canEdit={canEdit}
                onEdit={() => startEdit(selected)}
                onDeleted={() => setSelectedId(null)}
              />
            )
          )}

          {mode === "world" && showMarkers && (
            <MapLegend
              open={legendOpen}
              onOpenChange={changeLegendOpen}
              places={visiblePlaces}
              query={query}
              onQueryChange={setQuery}
              showSearch={false}
              selectedId={selected?.id ?? null}
              onSelect={handleSelectFromList}
            />
          )}

          {mode === "zones" && (
            <ZonesPanel zones={visibleZones} query={query} selectedId={selectedZoneId} onSelect={handleSelectZone} />
          )}
        </div>

        {/* Телефон: обозначения списком. Лежит внутри раздела, а не в портале, поэтому виден и в полноэкранном режиме. */}
        {listOpen && (
          <div className="absolute inset-0 z-30 md:hidden">
            <button
              type="button"
              aria-label="Закрыть обозначения"
              className="absolute inset-0 bg-black/30"
              onClick={() => setListOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Условные обозначения"
              className="absolute inset-x-0 bottom-0 flex max-h-[80%] flex-col gap-3 rounded-t-xl border-t bg-popover pt-4 text-popover-foreground shadow-lg"
            >
              <div className="flex items-start justify-between gap-2 px-4">
                <div>
                  <h2 className="font-medium text-base leading-none">
                    {mode === "world" ? "Условные обозначения" : "Игровые зоны"}
                  </h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {mode === "world"
                      ? "Выберите место, чтобы показать его на карте"
                      : "Выберите зону, чтобы показать её на карте"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="-mt-2 -mr-2 size-10"
                  aria-label="Закрыть"
                  onClick={() => setListOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              </div>
              {mode === "world" ? (
                <LegendList
                  places={visiblePlaces}
                  query={query}
                  onQueryChange={setQuery}
                  showSearch={false}
                  selectedId={selected?.id ?? null}
                  onSelect={handleSelectFromList}
                  className="flex-1 pt-0"
                />
              ) : (
                <ZonesList
                  zones={visibleZones}
                  query={query}
                  selectedId={selectedZoneId}
                  onSelect={handleSelectZone}
                  className="flex-1 pt-0"
                />
              )}
            </div>
          </div>
        )}
      </section>
    </MapTipContainer>
  );
}
