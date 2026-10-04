"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "cn";
import { Maximize2, Minimize2, Minus, Plus } from "lucide-react";

import { fractionToWorld, getCategory, type MapPlace, type PlaceCategoryId, worldToFraction } from "./map-data";

const mapImageUrl = "/map.png";

/** Метка, которую администратор сейчас ставит или двигает. */
export interface DraftMarker {
  x: number;
  y: number;
  category: PlaceCategoryId;
}

/** Просьба показать место. n меняется при каждом запросе, чтобы можно было повторить то же место. */
export interface FocusRequest {
  id: string;
  n: number;
  /** Если координаты известны заранее, карта не ищет метку в списке */
  point?: { x: number; y: number };
}

interface GameMapProps {
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** Режим выбора точки: клик по карте не выделяет, а передаёт координаты в onPick. */
  pickMode?: boolean;
  onPick?: (point: { x: number; y: number }) => void;
  draft?: DraftMarker | null;
  focus?: FocusRequest | null;
}

interface View {
  zoom: number;
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const FOCUS_ZOOM = 3;
/** Сдвиг меньше этого порога считается кликом, а не перетаскиванием. */
const CLICK_SLOP = 5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Карта квадратная и всегда закрывает окно целиком, поэтому её базовая сторона равна большей стороне окна. */
const baseSide = (size: Size) => Math.max(size.width, size.height);

function clampView(view: View, size: Size): View {
  const side = baseSide(size) * view.zoom;
  const limitX = Math.max(0, (side - size.width) / 2);
  const limitY = Math.max(0, (side - size.height) / 2);
  return { zoom: view.zoom, x: clamp(view.x, -limitX, limitX), y: clamp(view.y, -limitY, limitY) };
}

/** Меняет масштаб так, чтобы точка под курсором (anchor, от центра окна) осталась на месте. */
function zoomView(view: View, size: Size, nextZoom: number, anchor: { x: number; y: number }): View {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const ratio = zoom / view.zoom;
  return clampView({ zoom, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio }, size);
}

const CENTER = { x: 0, y: 0 };
const INITIAL_VIEW: View = { zoom: 1, x: 0, y: 0 };

export default function GameMap({
  places,
  selectedId,
  onSelect,
  isFullscreen,
  onToggleFullscreen,
  pickMode = false,
  onPick,
  draft,
  focus,
}: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setViewState] = useState<View>(INITIAL_VIEW);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);

  // Актуальные значения для обработчиков событий, чтобы они не работали с устаревшим состоянием.
  const viewRef = useRef(view);
  const sizeRef = useRef(size);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; viewX: number; viewY: number; moved: boolean } | null>(null);
  const pinchDistance = useRef(0);
  const pickModeRef = useRef(pickMode);
  const onPickRef = useRef(onPick);
  pickModeRef.current = pickMode;
  onPickRef.current = onPick;

  const setView = useCallback((next: View) => {
    viewRef.current = next;
    setViewState(next);
  }, []);

  // Размер окна карты: нужен для границ перетаскивания и для пересчёта координат клика.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      const next = { width: element.clientWidth, height: element.clientHeight };
      sizeRef.current = next;
      setSize(next);
      setView(clampView(viewRef.current, next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [setView]);

  const pointerToCenter = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return CENTER;
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  };

  const zoomBy = useCallback(
    (factor: number, anchor = CENTER) => {
      setAnimating(false);
      const current = viewRef.current;
      setView(zoomView(current, sizeRef.current, current.zoom * factor, anchor));
    },
    [setView],
  );

  // Колесо мыши: слушатель нативный и не пассивный, иначе preventDefault не работает и страница прокручивается.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      zoomBy(Math.exp(-pixels * 0.0015), {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  // Показать запрошенную метку: приблизить и поставить в центр.
  // Если координат в запросе нет, запрос ждёт, пока метка появится в списке.
  const appliedFocus = useRef(0);
  useEffect(() => {
    if (!focus || appliedFocus.current === focus.n) return;
    const point = focus.point ?? places.find((item) => item.id === focus.id);
    const current = viewRef.current;
    const currentSize = sizeRef.current;
    if (!point || currentSize.width === 0) return;
    appliedFocus.current = focus.n;
    const { fx, fy } = worldToFraction(point.x, point.y);
    const zoom = Math.max(current.zoom, FOCUS_ZOOM);
    const side = baseSide(currentSize) * zoom;
    setAnimating(true);
    setView(clampView({ zoom, x: -(fx - 0.5) * side, y: -(fy - 0.5) * side }, currentSize));
    const timer = window.setTimeout(() => setAnimating(false), 400);
    return () => window.clearTimeout(timer);
  }, [focus, places, setView]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setAnimating(false);

    if (pointers.current.size === 1) {
      const current = viewRef.current;
      gesture.current = {
        startX: event.clientX,
        startY: event.clientY,
        viewX: current.x,
        viewY: current.y,
        moved: false,
      };
      setDragging(true);
    } else if (pointers.current.size === 2) {
      // Второй палец: начинаем масштабирование щипком, перетаскивание отменяем.
      const [a, b] = [...pointers.current.values()];
      pinchDistance.current = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current) gesture.current.moved = true;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance.current > 0 && distance > 0) {
        zoomBy(distance / pinchDistance.current, pointerToCenter((a.x + b.x) / 2, (a.y + b.y) / 2));
      }
      pinchDistance.current = distance;
      return;
    }

    const start = gesture.current;
    if (!start) return;
    const dx = event.clientX - start.startX;
    const dy = event.clientY - start.startY;
    if (!start.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
    start.moved = true;
    const current = viewRef.current;
    setView(clampView({ zoom: current.zoom, x: start.viewX + dx, y: start.viewY + dy }, sizeRef.current));
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    pointers.current.delete(event.pointerId);
    const start = gesture.current;

    if (pointers.current.size === 0) {
      gesture.current = null;
      pinchDistance.current = 0;
      setDragging(false);

      // Короткое касание без сдвига в режиме выбора точки: считаем координаты под пальцем.
      if (!cancelled && start && !start.moved && pickModeRef.current && onPickRef.current) {
        const anchor = pointerToCenter(event.clientX, event.clientY);
        const current = viewRef.current;
        const side = baseSide(sizeRef.current) * current.zoom;
        const fx = (anchor.x - current.x) / side + 0.5;
        const fy = (anchor.y - current.y) / side + 0.5;
        if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) onPickRef.current(fractionToWorld(fx, fy));
      }
    } else if (pointers.current.size === 1) {
      // Один палец остался после щипка: продолжаем перетаскивание с текущей точки.
      const [rest] = [...pointers.current.values()];
      const current = viewRef.current;
      gesture.current = { startX: rest.x, startY: rest.y, viewX: current.x, viewY: current.y, moved: true };
      pinchDistance.current = 0;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const step = 80;
    const current = viewRef.current;
    const pan = (dx: number, dy: number) => {
      setAnimating(false);
      setView(clampView({ zoom: current.zoom, x: current.x + dx, y: current.y + dy }, sizeRef.current));
    };
    switch (event.key) {
      case "ArrowLeft":
        return pan(step, 0);
      case "ArrowRight":
        return pan(-step, 0);
      case "ArrowUp":
        return pan(0, step);
      case "ArrowDown":
        return pan(0, -step);
      case "+":
      case "=":
        return zoomBy(1.5);
      case "-":
      case "_":
        return zoomBy(1 / 1.5);
      case "0":
        return setView(INITIAL_VIEW);
      default:
    }
  };

  const side = baseSide(size);
  const stopPropagation = (event: React.SyntheticEvent) => event.stopPropagation();
  const controlClass =
    "flex size-10 items-center justify-center text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50";

  const draftFraction = draft ? worldToFraction(draft.x, draft.y) : null;
  const draftCategory = draft ? getCategory(draft.category) : null;

  return (
    <div
      ref={containerRef}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: карту можно двигать стрелками, поэтому ей нужен фокус
      tabIndex={0}
      className={cn(
        "relative size-full touch-none overflow-hidden bg-muted outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
        pickMode ? "cursor-crosshair" : dragging ? "cursor-grabbing" : "cursor-grab",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishPointer(event, false)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onKeyDown={handleKeyDown}
      onDoubleClick={(event) => {
        if (!pickMode) zoomBy(2, pointerToCenter(event.clientX, event.clientY));
      }}
      role="application"
      aria-label="Интерактивная карта штата. Стрелки двигают карту, плюс и минус меняют масштаб."
    >
      {pickMode && (
        <p className="pointer-events-none absolute inset-x-16 top-20 z-10 mx-auto w-fit max-w-full rounded-lg bg-foreground px-3 py-1.5 text-center text-background text-xs shadow-lg md:inset-x-auto md:top-4 md:left-1/2 md:-translate-x-1/2">
          {draft ? "Нажмите на карту, чтобы переместить метку" : "Нажмите на карту, чтобы поставить метку"}
        </p>
      )}

      {/* Кнопки управления лежат внутри окна карты, поэтому работают и в полноэкранном режиме */}
      <div
        className="absolute top-20 right-4 z-10 flex flex-col overflow-hidden rounded-lg border border-border/60 bg-background/90 shadow-lg backdrop-blur-sm md:top-4"
        onPointerDown={stopPropagation}
        onDoubleClick={stopPropagation}
      >
        <button
          type="button"
          className={cn(controlClass, "border-b border-border/60")}
          onClick={() => zoomBy(1.5)}
          disabled={view.zoom >= MAX_ZOOM}
          aria-label="Увеличить масштаб"
          title="Увеличить масштаб"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={cn(controlClass, "border-b border-border/60")}
          onClick={() => zoomBy(1 / 1.5)}
          disabled={view.zoom <= MIN_ZOOM}
          aria-label="Уменьшить масштаб"
          title="Уменьшить масштаб"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={controlClass}
          onClick={onToggleFullscreen}
          aria-pressed={isFullscreen}
          aria-label={isFullscreen ? "Выйти из полноэкранного режима" : "Развернуть карту на весь экран"}
          title={isFullscreen ? "Выйти из полноэкранного режима" : "На весь экран"}
        >
          {isFullscreen ? (
            <Minimize2 aria-hidden="true" className="size-4" />
          ) : (
            <Maximize2 aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>

      <div
        className={cn("absolute top-1/2 left-1/2", animating && "transition-transform duration-300 ease-out")}
        style={{
          width: side,
          height: side,
          transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.zoom})`,
        }}
      >
        {/* biome-ignore lint/performance/noImgElement: карта 8000×8000 отдаётся как есть, оптимизация Next ей не нужна */}
        <img
          src={mapImageUrl}
          alt="Карта штата Region"
          className="pointer-events-none size-full object-contain"
          draggable={false}
          decoding="async"
        />

        {places.map((place) => {
          const { fx, fy } = worldToFraction(place.x, place.y);
          const category = getCategory(place.category);
          const Icon = category.icon;
          const selected = selectedId === place.id;
          return (
            <button
              key={place.id}
              type="button"
              aria-label={place.name}
              aria-pressed={selected}
              className={cn(
                "group absolute flex size-10 items-center justify-center rounded-full outline-none",
                animating && "transition-transform duration-300 ease-out",
                selected && "z-10",
              )}
              // Метка обратна масштабу карты, поэтому на любом приближении остаётся одного размера
              style={{
                left: `${fx * 100}%`,
                top: `${fy * 100}%`,
                transform: `translate(-50%, -50%) scale(${1 / view.zoom})`,
              }}
              onPointerDown={stopPropagation}
              onDoubleClick={stopPropagation}
              onClick={() => onSelect(selected ? null : place.id)}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full ring-4 transition-transform group-hover:scale-110 group-focus-visible:ring-ring/60",
                  category.dotClass,
                  category.ringClass,
                  selected && "scale-125 ring-foreground/40",
                )}
              >
                <Icon aria-hidden="true" className="size-3.5" />
              </span>
              <span
                className={cn(
                  "pointer-events-none absolute bottom-full mb-0.5 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-background text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
                  selected && "opacity-100",
                )}
              >
                {place.name}
              </span>
            </button>
          );
        })}

        {draft && draftFraction && draftCategory && (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute z-20 flex size-10 items-center justify-center",
              animating && "transition-transform duration-300 ease-out",
            )}
            style={{
              left: `${draftFraction.fx * 100}%`,
              top: `${draftFraction.fy * 100}%`,
              transform: `translate(-50%, -50%) scale(${1 / view.zoom})`,
            }}
          >
            <span
              className={cn(
                "flex size-7 animate-pulse items-center justify-center rounded-full ring-4 ring-offset-2 ring-offset-background",
                draftCategory.dotClass,
                draftCategory.ringClass,
              )}
            >
              <draftCategory.icon className="size-4" />
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
