"use client";

import { useEffect, useRef } from "react";

import L from "leaflet";
import { Maximize, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

import { getCategory, MAP_TRANSFORMATION, MAP_WORLD, MAP_ZOOM, type MapPlace } from "./map-data";

import "leaflet/dist/leaflet.css";
import "./game-map.css";

interface GameMapProps {
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const worldBounds = L.latLngBounds([MAP_WORLD.minY, MAP_WORLD.minX], [MAP_WORLD.maxY, MAP_WORLD.maxX]);

// Область нажатия 44px — минимальный комфортный размер для пальца.
function createIcon(place: MapPlace, selected: boolean) {
  const category = getCategory(place.category);
  const dot = selected ? `size-5 ring-4 ${category.ringClass}` : "size-3.5";
  return L.divIcon({
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div class="flex size-11 items-center justify-center"><span class="${dot} ${category.dotClass} rounded-full border-2 border-background shadow-md transition-all"></span></div>`,
  });
}

export default function GameMap({ places, selectedId, onSelect }: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Создание карты
  useEffect(() => {
    const element = containerRef.current;
    if (!element || mapRef.current) return;

    const crs = L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(...MAP_TRANSFORMATION) });

    const map = L.map(element, {
      crs,
      zoomControl: false,
      attributionControl: false,
      minZoom: MAP_ZOOM.min,
      maxZoom: MAP_ZOOM.max,
      zoomSnap: 1,
      zoomDelta: 1,
      wheelPxPerZoomLevel: 90,
      bounceAtZoomLimits: false,
      maxBounds: worldBounds.pad(0.05),
      maxBoundsViscosity: 1,
    });

    // SVG вставляем в DOM (а не как <img>), чтобы он наследовал CSS-переменные темы:
    // --map-land, --map-buildings, --map-roads задаются в game-map.css.
    let disposed = false;
    let mapImage: L.SVGOverlay | null = null;
    fetch("/images/map-vector-with-land.svg")
      .then((response) => response.text())
      .then((text) => {
        if (disposed) return;
        const svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
        svg.querySelector("metadata")?.remove();
        mapImage = L.svgOverlay(svg as unknown as SVGElement, worldBounds, { interactive: false }).addTo(map);
      })
      .catch(() => {
        // Без картинки остаётся фон темы — метки продолжают работать.
      });

    map.fitBounds(worldBounds, { animate: false });
    map.setMinZoom(map.getZoom());
    map.on("click", () => onSelectRef.current(null));
    mapRef.current = map;

    // Сайдбар и поворот экрана меняют размер контейнера — пересчитываем карту.
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      map.setMinZoom(map.getBoundsZoom(worldBounds));
    });
    observer.observe(element);

    const markers = markersRef.current;
    return () => {
      disposed = true;
      observer.disconnect();
      markers.clear();
      mapImage?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Метки
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const group = L.layerGroup().addTo(map);
    const markers = markersRef.current;
    const canHover = window.matchMedia("(hover: hover)").matches;
    markers.clear();

    for (const place of places) {
      const marker = L.marker([place.y, place.x], { icon: createIcon(place, false), title: place.name });
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectRef.current(place.id);
      });
      if (canHover) marker.bindTooltip(place.name, { direction: "top", offset: [0, -16] });
      marker.addTo(group);
      markers.set(place.id, marker);
    }

    return () => {
      group.remove();
      markers.clear();
    };
  }, [places]);

  // Подсветка выбранной метки
  useEffect(() => {
    for (const place of places) {
      const marker = markersRef.current.get(place.id);
      if (!marker) continue;
      const selected = place.id === selectedId;
      marker.setIcon(createIcon(place, selected));
      marker.setZIndexOffset(selected ? 1000 : 0);
    }
  }, [places, selectedId]);

  // Перелёт к выбранной метке (на телефоне смещаем вверх, чтобы карточка её не перекрывала)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const marker = markersRef.current.get(selectedId);
    if (!marker) return;

    const zoom = Math.max(map.getZoom(), 2.5);
    const point = map.project(marker.getLatLng(), zoom);
    if (window.innerWidth < 768) point.y += map.getSize().y * 0.15;
    map.flyTo(map.unproject(point, zoom), zoom, { duration: 0.6 });
  }, [selectedId]);

  return (
    <div className="relative size-full">
      <div ref={containerRef} className="region-map isolate size-full overscroll-none" />
      <ButtonGroup
        orientation="vertical"
        aria-label="Масштаб карты"
        className="absolute top-1/2 right-3 z-10 -translate-y-1/2 shadow-sm"
      >
        <Button variant="outline" className="size-11" aria-label="Приблизить" onClick={() => mapRef.current?.zoomIn(1)}>
          <Plus className="size-5" />
        </Button>
        <Button variant="outline" className="size-11" aria-label="Отдалить" onClick={() => mapRef.current?.zoomOut(1)}>
          <Minus className="size-5" />
        </Button>
        <Button
          variant="outline"
          className="size-11"
          aria-label="Показать всю карту"
          onClick={() => mapRef.current?.fitBounds(worldBounds)}
        >
          <Maximize className="size-5" />
        </Button>
      </ButtonGroup>
    </div>
  );
}
