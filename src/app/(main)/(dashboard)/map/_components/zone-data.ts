/**
 * Игровые зоны для слоя «Карта игровых зон».
 * Зона — многоугольник в игровых координатах (те же x и y, что и у меток). Зоны рисует администрация прямо на карте
 * и хранятся они в базе (таблица map_zones), поэтому встроенного набора здесь нет.
 */

export const zoneColorIds = ["red", "gray", "blue", "green", "yellow"] as const;
export type ZoneColorId = (typeof zoneColorIds)[number];

export interface ZoneColor {
  id: ZoneColorId;
  label: string;
  /** Классы Tailwind записаны целиком (строкой), чтобы сборщик их не выкинул */
  fillClass: string;
  strokeClass: string;
  dotClass: string;
}

export const zoneColors: ZoneColor[] = [
  { id: "red", label: "Красная", fillClass: "fill-red-500/25", strokeClass: "stroke-red-500", dotClass: "bg-red-500" },
  {
    id: "gray",
    label: "Серая",
    fillClass: "fill-slate-400/25",
    strokeClass: "stroke-slate-400",
    dotClass: "bg-slate-400",
  },
  { id: "blue", label: "Голубая", fillClass: "fill-sky-400/25", strokeClass: "stroke-sky-400", dotClass: "bg-sky-400" },
  {
    id: "green",
    label: "Зелёная",
    fillClass: "fill-emerald-500/25",
    strokeClass: "stroke-emerald-500",
    dotClass: "bg-emerald-500",
  },
  {
    id: "yellow",
    label: "Жёлтая",
    fillClass: "fill-yellow-400/25",
    strokeClass: "stroke-yellow-400",
    dotClass: "bg-yellow-400",
  },
];

export const getZoneColor = (id: ZoneColorId): ZoneColor =>
  zoneColors.find((color) => color.id === id) ?? zoneColors[0];

export const ZONE_LIMITS = { name: 80, description: 500, minPoints: 3, maxPoints: 100 } as const;

export interface ZonePoint {
  x: number;
  y: number;
}

export interface MapZone {
  id: string;
  name: string;
  color: ZoneColorId;
  description?: string;
  /** Вершины многоугольника в игровых координатах, от трёх до ZONE_LIMITS.maxPoints */
  points: ZonePoint[];
}

/** Центр зоны (среднее вершин): сюда ставится подпись и сюда летит камера. */
export function zoneCenter(points: readonly ZonePoint[]): ZonePoint {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** Зона в работе: новая (id = null) или правится существующая. Точки меняются кликами по карте. */
export interface ZoneDraft {
  id: string | null;
  name: string;
  color: ZoneColorId;
  description: string;
  points: ZonePoint[];
}
