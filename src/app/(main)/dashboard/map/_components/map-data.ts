import { Car, HardHat, Landmark, MapPin, type LucideIcon, Store, Ticket } from "lucide-react";

/**
 * Границы игрового мира, которые соответствуют краям картинки карты (4096×4096).
 * TODO: подставьте реальные координаты углов вашей карты, чтобы метки вставали точно.
 * Сейчас: центр карты = (0, 0), 1 игровая единица = 1 пиксель при нативном зуме.
 */
export const MAP_WORLD = {
  minX: -2048,
  maxX: 2048,
  minY: -2048,
  maxY: 2048,
} as const;

/** SVG-карта имеет размер 4096×4096 и масштабируется Leaflet без потери детализации. */
export const MAP_ZOOM = { min: 0, max: 6, native: 4 } as const;

// Коэффициенты L.Transformation: px(z) = 2^z * (a * x + b).
// Мир занимает 256 * 2^native = 4096 пикселей на нативном зуме (4), отсюда a = 256 / ширина мира.
const scaleX = 256 / (MAP_WORLD.maxX - MAP_WORLD.minX);
const scaleY = 256 / (MAP_WORLD.maxY - MAP_WORLD.minY);

export const MAP_TRANSFORMATION: [number, number, number, number] = [
  scaleX,
  -scaleX * MAP_WORLD.minX,
  -scaleY,
  scaleY * MAP_WORLD.maxY,
];

export const placeCategoryIds = ["job", "shop", "state", "transport", "leisure", "other"] as const;
export type PlaceCategoryId = (typeof placeCategoryIds)[number];

export interface PlaceCategory {
  id: PlaceCategoryId;
  label: string;
  icon: LucideIcon;
  /** Цвет метки на карте. Работы используют цвет темы, остальные категории — именованные цвета Tailwind. */
  dotClass: string;
  ringClass: string;
}

export const placeCategories: PlaceCategory[] = [
  {
    id: "job",
    label: "Работы",
    icon: HardHat,
    dotClass: "bg-primary text-primary-foreground",
    ringClass: "ring-primary/30",
  },
  {
    id: "shop",
    label: "Магазины",
    icon: Store,
    dotClass: "bg-emerald-500 text-white",
    ringClass: "ring-emerald-500/30",
  },
  {
    id: "state",
    label: "Госструктуры",
    icon: Landmark,
    dotClass: "bg-sky-500 text-white",
    ringClass: "ring-sky-500/30",
  },
  {
    id: "transport",
    label: "Транспорт",
    icon: Car,
    dotClass: "bg-violet-500 text-white",
    ringClass: "ring-violet-500/30",
  },
  {
    id: "leisure",
    label: "Развлечения",
    icon: Ticket,
    dotClass: "bg-pink-500 text-white",
    ringClass: "ring-pink-500/30",
  },
  { id: "other", label: "Другое", icon: MapPin, dotClass: "bg-slate-500 text-white", ringClass: "ring-slate-500/30" },
];

export function getCategory(id: PlaceCategoryId): PlaceCategory {
  return placeCategories.find((category) => category.id === id) ?? placeCategories[placeCategories.length - 1];
}

export const PLACE_LIMITS = { name: 80, description: 500 } as const;

export interface MapPlace {
  id: string;
  name: string;
  x: number;
  y: number;
  category: PlaceCategoryId;
  description?: string;
}

// Начальный набор меток: при первом обращении к базе он копируется в таблицу map_places.
// TODO: координаты перенесены со старой карты LA — замените на координаты вашей карты.
const allPlaces: MapPlace[] = [
  { id: "job-electrician", name: "Работа Электрик", x: 734.63855, y: 128.54727, category: "job" },
  { id: "job-bus", name: "Работа Автобусник", x: 432.01242, y: -628.3286, category: "job" },
  { id: "job-collector", name: "Работа Инкассатор", x: 46.437027, y: -842.20435, category: "job" },
  { id: "job-postman", name: "Работа Почтальон", x: -197.82831, y: 6235.436, category: "job" },
  { id: "job-mower", name: "Работа Газонокосильщик", x: -1331.847, y: 41.47328, category: "job" },
  { id: "job-taxi", name: "Работа Такси", x: 900.21326, y: -173.38603, category: "job" },
  { id: "job-delivery", name: "Работа Развозчик товаров", x: 1737.877, y: 3709.549, category: "job" },
];

export function isInsideWorld(point: { x: number; y: number }) {
  return (
    point.x >= MAP_WORLD.minX && point.x <= MAP_WORLD.maxX && point.y >= MAP_WORLD.minY && point.y <= MAP_WORLD.maxY
  );
}

/** Метки за пределами карты не показываем, чтобы не ломать интерфейс. */
export const seedPlaces: MapPlace[] = allPlaces.filter(isInsideWorld);

/** Встроенный набор меток: его показывает поиск, пока база недоступна. */
export const mapPlaces = seedPlaces;

/** Переводит долю от размера карты (0..1, от левого верхнего угла) в игровые координаты. */
export function fractionToWorld(fx: number, fy: number) {
  return {
    x: MAP_WORLD.minX + fx * (MAP_WORLD.maxX - MAP_WORLD.minX),
    y: MAP_WORLD.maxY - fy * (MAP_WORLD.maxY - MAP_WORLD.minY),
  };
}

/** Обратное преобразование: игровые координаты в долю от размера карты. */
export function worldToFraction(x: number, y: number) {
  return {
    fx: (x - MAP_WORLD.minX) / (MAP_WORLD.maxX - MAP_WORLD.minX),
    fy: (MAP_WORLD.maxY - y) / (MAP_WORLD.maxY - MAP_WORLD.minY),
  };
}
