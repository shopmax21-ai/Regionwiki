"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import dynamic from "next/dynamic";

import { cn } from "cn";
import { List, Plus, Upload, X } from "lucide-react";

import { PlaceCard } from "@/app/(main)/dashboard/map/_components/place-card";
import { PlacesPanel } from "@/app/(main)/dashboard/map/_components/places-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { createPlaceAction, updatePlaceAction } from "../_actions";
import type { DraftMarker, FocusRequest } from "./game-map";
import { isInsideWorld, type MapPlace, type PlaceCategoryId, placeCategories } from "./map-data";
import { type PlaceDraft, PlaceEditor } from "./place-editor";
import { PlaceImport } from "./place-import";

// Карта работает только в браузере
const GameMap = dynamic(() => import("@/app/(main)/dashboard/map/_components/game-map"), {
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

const parseCoordinate = (value: string): number | null => {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCoordinate = (value: number) => String(Math.round(value * 100) / 100);

export function MapSection({ places: allPlaces, editor, problem }: MapSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
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
    return { x, y, category: draft.category };
  }, [draft]);

  const focusPlace = (id: string, point?: { x: number; y: number }) =>
    setFocus((current) => ({ id, n: (current?.n ?? 0) + 1, point }));

  const handleSelectFromList = (id: string) => {
    setSelectedId(id);
    focusPlace(id);
    setListOpen(false);
  };

  // ---------- Полноэкранный режим ----------
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
      if (section && document.fullscreenElement === section) void document.exitFullscreen().catch(() => {});
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
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
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

  // ---------- Редактор меток ----------

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
        draft={draftMarker}
        focus={focus}
      />

      {/* Десктоп: боковая панель */}
      <aside className="absolute top-4 bottom-4 left-4 z-10 hidden w-80 flex-col gap-3 rounded-xl bg-card/95 py-4 shadow-sm ring-1 ring-foreground/10 backdrop-blur md:flex">
        <div className="flex flex-col gap-3 px-4">
          <div>
            <h2 className="font-medium text-lg leading-none tracking-tight">Карта штата</h2>
            <p className="mt-1 text-muted-foreground text-sm">Важные места и полезные адреса</p>
          </div>
          <CategoryChips value={category} onChange={setCategory} className="flex-wrap overflow-visible" />
          {canEdit && editorButtons}
          {editor === "unavailable" && (
            <p className="text-muted-foreground text-xs">
              Редактирование карты сейчас недоступно{problem ? `: ${problem}` : ""}
            </p>
          )}
        </div>
        <PlacesPanel
          places={visiblePlaces}
          query={query}
          onQueryChange={setQuery}
          selectedId={selected?.id ?? null}
          onSelect={handleSelectFromList}
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

      {/* Телефон: список мест. Лежит внутри раздела, а не в портале, поэтому виден и в полноэкранном режиме. */}
      {listOpen && (
        <div className="absolute inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label="Закрыть список мест"
            className="absolute inset-0 bg-black/30"
            onClick={() => setListOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Места на карте"
            className="absolute inset-x-0 bottom-0 flex max-h-[80%] flex-col gap-3 rounded-t-xl border-t bg-popover pt-4 text-popover-foreground shadow-lg"
          >
            <div className="flex items-start justify-between gap-2 px-4">
              <div>
                <h2 className="font-medium text-base leading-none">Места на карте</h2>
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
            <PlacesPanel
              places={visiblePlaces}
              query={query}
              onQueryChange={setQuery}
              selectedId={selected?.id ?? null}
              onSelect={handleSelectFromList}
              className="min-h-0 flex-1"
            />
          </div>
        </div>
      )}
    </section>
  );
}
