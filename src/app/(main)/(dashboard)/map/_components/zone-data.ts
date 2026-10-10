/**
 * Игровые зоны для слоя «Карта игровых зон».
 * Зона — многоугольник в игровых координатах (те же x и y, что и у меток).
 *
 * ВАЖНО: зоны ниже — примеры, чтобы слой было с чем показать. Замените их настоящими:
 * добавьте свои зоны в массив zones, координаты точек берутся с обычной карты (режим выбора точки в редакторе).
 */

export const zoneKindIds = ["safe", "war", "restricted"] as const;
export type ZoneKindId = (typeof zoneKindIds)[number];

export interface ZoneKind {
  id: ZoneKindId;
  label: string;
  /** Классы Tailwind целиком (строкой), чтобы сборщик их не выкинул */
  fillClass: string;
  strokeClass: string;
  dotClass: string;
}

export const zoneKinds: ZoneKind[] = [
  {
    id: "safe",
    label: "Зелёные зоны",
    fillClass: "fill-emerald-500/25",
    strokeClass: "stroke-emerald-500",
    dotClass: "bg-emerald-500",
  },
  {
    id: "war",
    label: "Зоны конфликтов",
    fillClass: "fill-red-500/25",
    strokeClass: "stroke-red-500",
    dotClass: "bg-red-500",
  },
  {
    id: "restricted",
    label: "Закрытые территории",
    fillClass: "fill-amber-500/25",
    strokeClass: "stroke-amber-500",
    dotClass: "bg-amber-500",
  },
];

export const getZoneKind = (id: ZoneKindId): ZoneKind => zoneKinds.find((kind) => kind.id === id) ?? zoneKinds[0];

export interface MapZone {
  id: string;
  name: string;
  kind: ZoneKindId;
  description?: string;
  /** Вершины многоугольника в игровых координатах, минимум три */
  points: { x: number; y: number }[];
}

/** Прямоугольная зона по двум противоположным углам */
const rect = (x1: number, y1: number, x2: number, y2: number) => [
  { x: x1, y: y1 },
  { x: x2, y: y1 },
  { x: x2, y: y2 },
  { x: x1, y: y2 },
];

export const zones: MapZone[] = [
  { id: "example-safe", name: "Зелёная зона (пример)", kind: "safe", points: rect(300, -300, 1100, 400) },
  { id: "example-war", name: "Зона конфликтов (пример)", kind: "war", points: rect(-1600, -400, -900, 300) },
  {
    id: "example-restricted",
    name: "Закрытая территория (пример)",
    kind: "restricted",
    points: rect(1400, 3300, 2100, 4100),
  },
];

/** Центр зоны (среднее вершин): сюда ставится подпись и сюда летит камера. */
export function zoneCenter(zone: MapZone) {
  const sum = zone.points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / zone.points.length, y: sum.y / zone.points.length };
}
