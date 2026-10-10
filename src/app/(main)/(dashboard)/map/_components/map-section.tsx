"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import dynamic from "next/dynamic";

import { cn } from "cn";
import { LayoutGrid, List, PanelLeftClose, PanelLeftOpen, Plus, Search, Upload, X } from "lucide-react";

import { LegendList, MapLegend } from "@/app/(main)/(dashboard)/map/_components/map-legend";
import { PlaceCard } from "@/app/(main)/(dashboard)/map/_components/place-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { createPlaceAction, updatePlaceAction } from "../_actions";
import type { DraftMarker, FocusRequest } from "./game-map";
import { isInsideWorld, type MapPlace, type PlaceCategoryId, placeCategories } from "./map-data";
import { MapTip, MapTipContainer } from "./map-tip";
import { type PlaceDraft, PlaceEditor } from "./place-editor";
import { PlaceImport } from "./place-import";

// Карта работает только в браузере
const GameMap = dynamic(() => import("@/app/(main)/(dashboard)/map/_components/game-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

type CategoryFilter = PlaceCategoryId | "all";

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
          className={cn("h-11 shrink-0 px-4 shadow-sm md:h-9", value !== chip.id && "bg-card/90 backdrop-blur")}
          onClick={() => onChange(chip.id)}
        >
          {chip.label}
        </Button>
      ))}
    </fieldset>
  );
}

/** Свёрнутая панель запоминается в браузере: на следующем заходе карта откроется так же. */
const PANEL_STORAGE_KEY = "region-map-panel-collapsed";
/** Так же запоминается, открыт ли блок «Условные обозначения». */
const LEGEND_STORAGE_KEY = "region-map-legend-open";

/** Узкие кнопки категорий для свёрнутой панели: «Все» и по значку на категорию. */
function CategoryRail({ value, onChange }: { value: CategoryFilter; onChange: (value: CategoryFilter) => void }) {
  const items: { id: CategoryFilter; label: string; icon: typeof LayoutGrid }[] = [
    { id: "all", label: "Все категории", icon: LayoutGrid },
    ...placeCategories.map(({ id, label, icon }) => ({ id, label, icon })),
  ];
  return (
    <fieldset aria-label="Категории" className="flex flex-col items-center gap-1 border-0 p-0">
      {items.map(({ id, label, icon: Icon }) => (
        <MapTip key={id} label={label} side="right">
          <Button
            variant={value === id ? "default" : "ghost"}
            size="icon"
            aria-label={label}
            aria-pressed={value === id}
            className="size-10"
            onClick={() => onChange(id)}
          >
            <Icon aria-hidden="true" className="size-4" />
          </Button>
        </MapTip>
      ))}
    </fieldset>
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
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
  const visiblePlaces = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allPlaces.filter(
      (place) =>
        place.id !== draft?.id &&
        (category === "all" || place.category === category) &&
        place.name.toLowerCase().includes(normalized),
    );
  }, [allPlaces, query, category, draft?.id]);

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

  // Свёрнутая боковая панель
  useEffect(() => {
    try {
      if (window.localStorage.getItem(PANEL_STORAGE_KEY) === "1") setCollapsed(true);
      if (window.localStorage.getItem(LEGEND_STORAGE_KEY) === "0") setLegendOpen(false);
    } catch {
      // Хранилище браузера недоступно: панель просто открывается развёрнутой
    }
  }, []);

  const changeCollapsed = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(PANEL_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Не страшно: выбор просто не запомнится
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
    setSelectedId(null);
    setListOpen(false);
    setImportOpen(false);
    setEditorError(null);
    setDraft({
      id: null,
      name: "",
      category: category === "all" ? "other" : category,
      description: "",
      icon: "",
      x: "",
      y: "",
    });
  };

  const startImport = () => {
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
        setCategory("all");
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

  const editorButtons = (
    <div className="flex gap-2">
      <Button className="h-9 flex-1" onClick={startCreate} disabled={draft !== null}>
        <Plus data-icon="inline-start" /> Добавить метку
      </Button>
      <Button variant="outline" className="h-9" onClick={startImport} disabled={draft !== null || importOpen}>
        <Upload data-icon="inline-start" /> Загрузить
      </Button>
    </div>
  );

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

        {/* Десктоп: боковая панель. Сворачивается в узкую полосу со значками, чтобы не закрывать карту. */}
        {collapsed ? (
          <aside
            aria-label="Панель карты (свёрнута)"
            className="absolute top-4 left-4 z-10 hidden w-14 flex-col items-center gap-2 rounded-xl bg-card/95 py-2 shadow-sm ring-1 ring-foreground/10 backdrop-blur md:flex"
          >
            <MapTip label="Развернуть панель" side="right">
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label="Развернуть панель"
                aria-expanded={false}
                onClick={() => changeCollapsed(false)}
              >
                <PanelLeftOpen aria-hidden="true" className="size-4" />
              </Button>
            </MapTip>
            <CategoryRail value={category} onChange={setCategory} />
            <div className="flex flex-col items-center gap-1 border-t pt-2">
              <MapTip label={query ? `Поиск: «${query}». Открыть обозначения` : "Поиск по меткам"} side="right">
                <Button
                  variant={query ? "default" : "ghost"}
                  size="icon"
                  className="size-10"
                  aria-label="Открыть поиск по меткам"
                  onClick={() => changeLegendOpen(true)}
                >
                  <Search aria-hidden="true" className="size-4" />
                </Button>
              </MapTip>
              {canEdit && (
                <>
                  <MapTip label="Добавить метку" side="right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      aria-label="Добавить метку"
                      onClick={startCreate}
                      disabled={draft !== null}
                    >
                      <Plus aria-hidden="true" className="size-4" />
                    </Button>
                  </MapTip>
                  <MapTip label="Загрузить метки из файла" side="right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      aria-label="Загрузить метки из файла"
                      onClick={startImport}
                      disabled={draft !== null || importOpen}
                    >
                      <Upload aria-hidden="true" className="size-4" />
                    </Button>
                  </MapTip>
                </>
              )}
            </div>
          </aside>
        ) : (
          <aside className="absolute top-4 left-4 z-10 hidden w-80 flex-col gap-3 rounded-xl bg-card/95 py-4 shadow-sm ring-1 ring-foreground/10 backdrop-blur md:flex">
            <div className="flex flex-col gap-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium text-lg leading-none tracking-tight">Карта штата</h2>
                  <p className="mt-1 text-muted-foreground text-sm">Важные места и полезные адреса</p>
                </div>
                <MapTip label="Свернуть панель" side="bottom">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mt-1 -mr-2 size-9 shrink-0"
                    aria-label="Свернуть панель"
                    aria-expanded
                    onClick={() => changeCollapsed(true)}
                  >
                    <PanelLeftClose aria-hidden="true" className="size-4" />
                  </Button>
                </MapTip>
              </div>
              <CategoryChips value={category} onChange={setCategory} className="flex-wrap overflow-visible" />
              {canEdit && editorButtons}
              {editor === "unavailable" && (
                <p className="text-muted-foreground text-xs">
                  Редактирование карты сейчас недоступно{problem ? `: ${problem}` : ""}
                </p>
              )}
            </div>
          </aside>
        )}

        {/* Телефон: кнопка списка и категории сверху */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-3 md:hidden">
          <Button
            variant="outline"
            className="h-11 shrink-0 gap-2 bg-card/90 px-4 shadow-sm backdrop-blur"
            onClick={() => setListOpen(true)}
          >
            <List className="size-4" />
            Метки
            <Badge variant="secondary">{visiblePlaces.length}</Badge>
          </Button>
          {canEdit && (
            <>
              <Button
                className="size-11 shrink-0 shadow-sm"
                onClick={startCreate}
                disabled={draft !== null}
                aria-label="Добавить метку"
              >
                <Plus className="size-5" />
              </Button>
              <Button
                variant="outline"
                className="size-11 shrink-0 bg-card/90 shadow-sm backdrop-blur"
                onClick={startImport}
                disabled={draft !== null || importOpen}
                aria-label="Загрузить метки из файла"
              >
                <Upload className="size-5" />
              </Button>
            </>
          )}
          <CategoryChips value={category} onChange={setCategory} className="-mr-3 min-w-0 pr-3" />
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
                // Фильтры могли бы спрятать загруженные метки
                setQuery("");
                setCategory("all");
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

          <MapLegend
            open={legendOpen}
            onOpenChange={changeLegendOpen}
            places={visiblePlaces}
            query={query}
            onQueryChange={setQuery}
            selectedId={selected?.id ?? null}
            onSelect={handleSelectFromList}
          />
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
                  <h2 className="font-medium text-base leading-none">Условные обозначения</h2>
                  <p className="mt-1 text-muted-foreground text-sm">Выберите место, чтобы показать его на карте</p>
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
              <LegendList
                places={visiblePlaces}
                query={query}
                onQueryChange={setQuery}
                selectedId={selected?.id ?? null}
                onSelect={handleSelectFromList}
                className="flex-1 pt-0"
              />
            </div>
          </div>
        )}
      </section>
    </MapTipContainer>
  );
}
