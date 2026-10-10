"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "cn";
import { Maximize2, Minimize2, Minus, Plus } from "lucide-react";

import {
  fractionToWorld,
  getCategory,
  isPlaceIconImage,
  type MapPlace,
  type PlaceCategoryId,
  worldToFraction,
} from "./map-data";
import { MapTip } from "./map-tip";
import { MarkerBadge } from "./place-icons";

/** Карта нарезана на плитки 256 px: /images/map-tiles/{z}/{x}x{y}.webp, на уровне z сетка 2^z × 2^z. */
const TILE_URL = "/images/map-tiles";
const TILE_SIZE = 256;
const TILE_MAX_Z = 5;
/** Уровень, который лежит под детальными плитками целиком и скрывает пустоты, пока они грузятся. */
const BACKDROP_Z = 2;
/** Фон карты — тёмный, как в самой картинке. */
const MAP_BACKGROUND = "#161616";

/** Метка, которую администратор сейчас ставит или двигает. */
export interface DraftMarker {
  x: number;
  y: number;
  category: PlaceCategoryId;
  icon?: string;
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
  /**
   * Встроенная карта (в гайде): колесо мыши масштабирует только вместе с Ctrl, иначе страница не прокручивалась бы,
   * а кнопки управления ставятся ближе к углу.
   */
  embedded?: boolean;
  /** Скрыть кнопку «на весь экран» (в гайде карта разворачивается не на весь экран, а остаётся в тексте) */
  hideFullscreen?: boolean;
  /** Точки, которые нужно уместить в окно при открытии и при смене набора. Без них карта открывается целиком. */
  fit?: readonly { x: number; y: number }[];
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

/** Масштаб 1 — карта целиком вписана в окно. Меньше 1 — можно отдалить так, что вокруг карты остаётся пустое поле. */
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 10;
const FOCUS_ZOOM = 5;
/** Насколько карту можно утащить за край окна (доля размера окна): так же, как на карте Majestic, она «пружинит» у границ. */
const PAN_SLACK = 0.2;
/** Длительность плавного масштабирования кнопками, двойным кликом и клавишами, мс */
const ZOOM_ANIMATION_MS = 300;
/** Сдвиг меньше этого порога считается кликом, а не перетаскиванием. */
const CLICK_SLOP = 5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Карта квадратная и при масштабе 1 целиком помещается в окно, поэтому её базовая сторона равна меньшей стороне окна. */
const baseSide = (size: Size) => Math.min(size.width, size.height);

/** Предел сдвига по одной оси: пока карта больше окна — её края, плюс небольшой запас, чтобы край можно было отодвинуть. */
const panLimit = (side: number, viewport: number) => Math.max(0, (side - viewport) / 2) + viewport * PAN_SLACK;

function clampView(view: View, size: Size): View {
  const side = baseSide(size) * view.zoom;
  const limitX = panLimit(side, size.width);
  const limitY = panLimit(side, size.height);
  return { zoom: view.zoom, x: clamp(view.x, -limitX, limitX), y: clamp(view.y, -limitY, limitY) };
}

/** Меняет масштаб так, чтобы точка под курсором (anchor, от центра окна) осталась на месте. */
function zoomView(view: View, size: Size, nextZoom: number, anchor: { x: number; y: number }): View {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const ratio = zoom / view.zoom;
  return clampView(
    { zoom, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio },
    size,
  );
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
  embedded = false,
  hideFullscreen = false,
  fit,
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
  const embeddedRef = useRef(embedded);
  pickModeRef.current = pickMode;
  onPickRef.current = onPick;
  embeddedRef.current = embedded;

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

  // Плавность нужна кнопкам, двойному клику и клавишам. Колесо и щипок идут без неё, иначе карта отставала бы от пальцев.
  const smoothTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(smoothTimer.current), []);

  const zoomBy = useCallback(
    (factor: number, anchor = CENTER, smooth = false) => {
      window.clearTimeout(smoothTimer.current);
      setAnimating(smooth);
      if (smooth) smoothTimer.current = window.setTimeout(() => setAnimating(false), ZOOM_ANIMATION_MS);
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
      // В гайде обычная прокрутка колесом листает страницу, а масштаб включается с Ctrl (так же работает щипок на тачпаде)
      if (embeddedRef.current && !(event.ctrlKey || event.metaKey)) return;
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

  // Уместить заданные точки в окно: при открытии и каждый раз, когда набор точек меняется.
  // Размер окна в зависимостях не нужен: после изменения размера границы пересчитывает ResizeObserver.
  const fitKey = fit ? fit.map((point) => `${point.x},${point.y}`).join("|") : "";
  const ready = size.width > 0 && size.height > 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: набор точек сравнивается по fitKey, а размер читается из ref
  useEffect(() => {
    if (!fit || fit.length === 0 || !ready) return;
    const currentSize = sizeRef.current;
    const points = fit.map((point) => worldToFraction(point.x, point.y));
    const xs = points.map((point) => point.fx);
    const ys = points.map((point) => point.fy);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const base = baseSide(currentSize);
    // Запас по краям, чтобы крайние метки и их подписи не прилипали к границе окна
    const padding = 1.8;
    const zoomX = currentSize.width / (base * Math.max(maxX - minX, 0.01) * padding);
    const zoomY = currentSize.height / (base * Math.max(maxY - minY, 0.01) * padding);
    const zoom = clamp(Math.min(zoomX, zoomY), MIN_ZOOM, fit.length === 1 ? FOCUS_ZOOM : MAX_ZOOM - 2);
    const side = base * zoom;
    setAnimating(false);
    setView(clampView({ zoom, x: -(cx - 0.5) * side, y: -(cy - 0.5) * side }, currentSize));
  }, [fitKey, ready, setView]);

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
        return zoomBy(1.5, CENTER, true);
      case "-":
      case "_":
        return zoomBy(1 / 1.5, CENTER, true);
      case "0":
        window.clearTimeout(smoothTimer.current);
        setAnimating(true);
        smoothTimer.current = window.setTimeout(() => setAnimating(false), ZOOM_ANIMATION_MS);
        return setView(INITIAL_VIEW);
      default:
    }
  };

  const side = baseSide(size);

  // Уровень плиток зависит от размера карты на экране; грузим только те плитки, что попадают в окно.
  const tileLevel = clamp(
    Math.ceil(Math.log2(Math.max(1, (side * view.zoom * (globalThis.devicePixelRatio || 1)) / TILE_SIZE))),
    BACKDROP_Z,
    TILE_MAX_Z,
  );
  const tiles = useMemo(() => {
    if (side === 0 || tileLevel === BACKDROP_Z) return [];
    const count = 2 ** tileLevel;
    const full = side * view.zoom;
    const left = (-size.width / 2 - view.x) / full + 0.5;
    const right = (size.width / 2 - view.x) / full + 0.5;
    const top = (-size.height / 2 - view.y) / full + 0.5;
    const bottom = (size.height / 2 - view.y) / full + 0.5;
    const x0 = Math.max(0, Math.floor(left * count));
    const x1 = Math.min(count - 1, Math.floor(right * count));
    const y0 = Math.max(0, Math.floor(top * count));
    const y1 = Math.min(count - 1, Math.floor(bottom * count));
    const list: { z: number; x: number; y: number }[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) list.push({ z: tileLevel, x, y });
    return list;
  }, [side, size.width, size.height, view.x, view.y, view.zoom, tileLevel]);
  const backdrop = useMemo(() => {
    const list: { z: number; x: number; y: number }[] = [];
    for (let y = 0; y < 2 ** BACKDROP_Z; y++) for (let x = 0; x < 2 ** BACKDROP_Z; x++) list.push({ z: BACKDROP_Z, x, y });
    return list;
  }, []);
  const stopPropagation = (event: React.SyntheticEvent) => event.stopPropagation();
  const controlClass =
    "flex size-11 items-center justify-center rounded-lg bg-black/70 text-white outline-none transition-colors hover:bg-black/90 focus-visible:bg-black/90 focus-visible:ring-3 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50";

  const draftFraction = draft ? worldToFraction(draft.x, draft.y) : null;
  const draftCategory = draft ? getCategory(draft.category) : null;

  return (
    <div
      ref={containerRef}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: карту можно двигать стрелками, поэтому ей нужен фокус
      tabIndex={0}
      className={cn(
        "relative size-full touch-none overflow-hidden outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
        pickMode ? "cursor-crosshair" : dragging ? "cursor-grabbing" : "cursor-grab",
      )}
      style={{ background: MAP_BACKGROUND }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishPointer(event, false)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onKeyDown={handleKeyDown}
      onDoubleClick={(event) => {
        if (!pickMode) zoomBy(2, pointerToCenter(event.clientX, event.clientY), true);
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
      {/* biome-ignore lint/a11y/noStaticElementInteractions: обработчики только останавливают всплытие событий карты */}
      <div
        className={cn(
          "absolute z-10 flex gap-2.5",
          embedded ? "top-3 right-3" : "top-20 right-4 md:top-4",
        )}
        onPointerDown={stopPropagation}
        onDoubleClick={stopPropagation}
      >
        <MapTip label="Увеличить масштаб" side="left">
          <button
            type="button"
            className={controlClass}
            onClick={() => zoomBy(1.5, CENTER, true)}
            disabled={view.zoom >= MAX_ZOOM}
            aria-label="Увеличить масштаб"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </MapTip>
        <MapTip label="Уменьшить масштаб" side="left">
          <button
            type="button"
            className={controlClass}
            onClick={() => zoomBy(1 / 1.5, CENTER, true)}
            disabled={view.zoom <= MIN_ZOOM}
            aria-label="Уменьшить масштаб"
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
        </MapTip>
        {!hideFullscreen && (
          <MapTip label={isFullscreen ? "Выйти из полноэкранного режима" : "На весь экран"} side="left">
            <button
              type="button"
              className={controlClass}
              onClick={onToggleFullscreen}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? "Выйти из полноэкранного режима" : "Развернуть карту на весь экран"}
            >
              {isFullscreen ? (
                <Minimize2 aria-hidden="true" className="size-4" />
              ) : (
                <Maximize2 aria-hidden="true" className="size-4" />
              )}
            </button>
          </MapTip>
        )}
      </div>

      <div
        className={cn("absolute top-1/2 left-1/2", animating && "transition-transform duration-300 ease-out")}
        style={{
          width: side,
          height: side,
          transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.zoom})`,
        }}
      >
        {[backdrop, tiles].map((layer) =>
          layer.map((tile) => (
            // biome-ignore lint/performance/noImgElement: плитки карты отдаются как есть, оптимизация Next им не нужна
            <img
              key={`${tile.z}/${tile.x}x${tile.y}`}
              src={`${TILE_URL}/${tile.z}/${tile.x}x${tile.y}.webp`}
              alt=""
              aria-hidden="true"
              draggable={false}
              decoding="async"
              className="pointer-events-none absolute"
              style={{
                left: `${(tile.x / 2 ** tile.z) * 100}%`,
                top: `${(tile.y / 2 ** tile.z) * 100}%`,
                width: `${100 / 2 ** tile.z}%`,
                height: `${100 / 2 ** tile.z}%`,
              }}
            />
          )),
        )}

        {places.map((place) => {
          const { fx, fy } = worldToFraction(place.x, place.y);
          const category = getCategory(place.category);
          const selected = selectedId === place.id;
          // Своя картинка рисуется без обводки и подложки, размером 20×20
          const bare = isPlaceIconImage(place.icon);
          return (
            <button
              key={place.id}
              type="button"
              aria-label={place.name}
              aria-pressed={selected}
              className={cn(
                "group absolute flex size-10 items-center justify-center rounded-full outline-none",
                animating && "transition-transform duration-300 ease-out",
                // У каждой метки свой transform, а значит свой слой: подпись не может выйти за него.
                // Поэтому при наведении и фокусе поднимаем всю метку выше соседних (и выше выбранной).
                selected && "z-10",
                "hover:z-30 focus-visible:z-30",
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
              <MarkerBadge
                category={place.category}
                icon={place.icon}
                size="sm"
                bare={bare}
                className={cn(
                  "transition-transform group-hover:scale-110",
                  bare
                    ? [
                        // Обводки нет, поэтому выбранную метку выделяем тенью, а фокус с клавиатуры — тонким кольцом
                        "rounded-sm group-focus-visible:ring-2 group-focus-visible:ring-ring/60",
                        selected && "scale-125 drop-shadow-[0_0_3px_var(--foreground)]",
                      ]
                    : [
                        "rounded-full ring-4 group-focus-visible:ring-ring/60",
                        category.ringClass,
                        selected && "scale-125 ring-foreground/40",
                      ],
                )}
              />
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
            <MarkerBadge
              category={draft.category}
              icon={draft.icon}
              size="md"
              bare={isPlaceIconImage(draft.icon)}
              className={cn(
                "animate-pulse",
                isPlaceIconImage(draft.icon)
                  ? "rounded-sm"
                  : ["rounded-full ring-4 ring-offset-2 ring-offset-background", draftCategory.ringClass],
              )}
            />
          </span>
        )}
      </div>
    </div>
  );
}
