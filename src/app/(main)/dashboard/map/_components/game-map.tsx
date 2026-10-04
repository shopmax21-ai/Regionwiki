"use client";

import { useRef, useState } from "react";

import { cn } from "cn";
import { List, Maximize2, Minus, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { MAP_WORLD, type MapPlace } from "./map-data";

const mapImageUrl = "/map.png";

interface GameMapProps {
  places?: MapPlace[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  category: "all" | "job";
  onCategoryChange: (category: "all" | "job") => void;
  placeCount: number;
  onOpenList: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

export default function GameMap({
  places = [],
  selectedId,
  onSelect,
  category,
  onCategoryChange,
  placeCount,
  onOpenList,
}: GameMapProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  const clampOffset = (value: number, viewportSize: number, scaledSize: number) => {
    const limit = Math.max(0, (scaledSize - viewportSize) / 2);
    return Math.min(limit, Math.max(-limit, value));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY };
    offsetStart.current = offset;
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const viewport = event.currentTarget.getBoundingClientRect();
    const scaledSize = Math.max(viewport.width, viewport.height) * zoom;
    setOffset({
      x: clampOffset(offsetStart.current.x + event.clientX - dragStart.current.x, viewport.width, scaledSize),
      y: clampOffset(offsetStart.current.y + event.clientY - dragStart.current.y, viewport.height, scaledSize),
    });
  };

  const updateZoom = (nextZoom: number) => {
    const viewport = mapRef.current?.getBoundingClientRect();
    if (!viewport) return;

    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const scaledSize = Math.max(viewport.width, viewport.height) * next;
    setZoom(next);
    setOffset((currentOffset) => ({
      x: clampOffset(currentOffset.x, viewport.width, scaledSize),
      y: clampOffset(currentOffset.y, viewport.height, scaledSize),
    }));
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateZoom(zoom * (event.deltaY > 0 ? 0.9 : 1.1));
  };

  const toggleFullscreen = async () => {
    if (!mapRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await mapRef.current.requestFullscreen();
    }
    setIsFullscreen(Boolean(document.fullscreenElement));
  };

  return (
    <div
      ref={mapRef}
      className={cn(
        "relative size-full overflow-hidden bg-[#1d3033]",
        dragging ? "cursor-grabbing" : "cursor-grab",
        isFullscreen && "bg-background",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onWheel={handleWheel}
      onDoubleClick={() => {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      }}
      role="application"
      aria-label="Интерактивная карта штата"
    >
      <div
        className={cn(
          "absolute inset-x-3 top-3 z-10 items-center gap-2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2",
          isFullscreen ? "flex" : "hidden",
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Button
          variant="outline"
          className="h-11 shrink-0 gap-2 bg-card/90 px-4 shadow-sm backdrop-blur"
          onClick={onOpenList}
        >
          <List data-icon="inline-start" />
          Места
          <Badge variant="secondary">{placeCount}</Badge>
        </Button>
        <div className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none]">
          {[
            { id: "all" as const, label: "Все" },
            { id: "job" as const, label: "Работы" },
          ].map((chip) => (
            <Button
              key={chip.id}
              variant={category === chip.id ? "default" : "outline"}
              aria-pressed={category === chip.id}
              className={cn("h-11 shrink-0 px-4 shadow-sm", category !== chip.id && "bg-card/90 backdrop-blur")}
              onClick={() => onCategoryChange(chip.id)}
            >
              {chip.label}
            </Button>
          ))}
        </div>
      </div>
      <div
        className="absolute right-4 top-20 z-10 flex flex-col overflow-hidden rounded-lg border border-border/60 bg-background/90 shadow-lg backdrop-blur-sm md:top-4"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="flex size-10 items-center justify-center border-b border-border/60 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => updateZoom(zoom + 1)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Увеличить масштаб"
          title="Увеличить масштаб"
        >
          <Plus aria-hidden="true" />
        </button>
        <button
          type="button"
          className="flex size-10 items-center justify-center border-b border-border/60 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => updateZoom(zoom - 1)}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Уменьшить масштаб"
          title="Уменьшить масштаб"
        >
          <Minus aria-hidden="true" />
        </button>
        <button
          type="button"
          className="flex size-10 items-center justify-center text-foreground transition-colors hover:bg-muted"
          onClick={toggleFullscreen}
          aria-label="Развернуть карту на весь экран"
          title="На весь экран"
        >
          <Maximize2 aria-hidden="true" />
        </button>
      </div>
      <div
        className="absolute left-1/2 top-1/2 aspect-square w-[max(100%,100vh)] select-none"
        style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})` }}
      >
        <img
          src={mapImageUrl}
          alt="Карта штата Region"
          className="pointer-events-none size-full object-contain"
          draggable={false}
        />
        {places.map((place) => {
          const left = ((place.x - MAP_WORLD.minX) / (MAP_WORLD.maxX - MAP_WORLD.minX)) * 100;
          const top = ((MAP_WORLD.maxY - place.y) / (MAP_WORLD.maxY - MAP_WORLD.minY)) * 100;
          const selected = selectedId === place.id;
          return (
            <button
              key={place.id}
              type="button"
              aria-label={place.name}
              aria-pressed={selected}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-2"
              style={{ left: `${left}%`, top: `${top}%` }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onSelect?.(selected ? null : place.id)}
            >
              <span
                className={cn(
                  "block size-3 rounded-full bg-primary ring-4 ring-primary/30 transition-transform",
                  selected && "scale-150",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
