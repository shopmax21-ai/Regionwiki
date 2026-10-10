import { cn } from "cn";
import {
  Anchor,
  Banknote,
  BedDouble,
  Beer,
  Bike,
  Building2,
  Bus,
  Camera,
  Car,
  Clapperboard,
  Coffee,
  Cross,
  Dumbbell,
  Factory,
  Fish,
  Flag,
  Flame,
  Fuel,
  Gamepad2,
  GraduationCap,
  Hammer,
  HardHat,
  Heart,
  Hospital,
  House,
  Key,
  Landmark,
  type LucideIcon,
  Mail,
  MapPin,
  Mountain,
  Music,
  Package,
  PawPrint,
  Phone,
  Pickaxe,
  Pill,
  Plane,
  Scissors,
  Shield,
  Ship,
  ShoppingCart,
  Siren,
  Skull,
  Star,
  Store,
  Ticket,
  Tractor,
  TrainFront,
  TreePine,
  Truck,
  Utensils,
  Warehouse,
  Wrench,
  Zap,
} from "lucide-react";

import { getCategory, isPlaceIconImage, isPlaceIconPreset, type PlaceCategoryId, type PlaceIconId } from "./map-data";

/** Готовые иконки для меток. Список id лежит в map-data.ts (его читает и сервер), здесь — сами значки и подписи. */
export const placeIconPresets: Record<PlaceIconId, { label: string; icon: LucideIcon }> = {
  pin: { label: "Точка", icon: MapPin },
  home: { label: "Дом", icon: House },
  building: { label: "Здание", icon: Building2 },
  store: { label: "Магазин", icon: Store },
  cart: { label: "Покупки", icon: ShoppingCart },
  hospital: { label: "Больница", icon: Hospital },
  cross: { label: "Медицина", icon: Cross },
  shield: { label: "Охрана", icon: Shield },
  siren: { label: "Полиция", icon: Siren },
  bank: { label: "Банк", icon: Landmark },
  money: { label: "Деньги", icon: Banknote },
  fuel: { label: "Заправка", icon: Fuel },
  car: { label: "Машина", icon: Car },
  bus: { label: "Автобус", icon: Bus },
  truck: { label: "Грузовик", icon: Truck },
  bike: { label: "Велосипед", icon: Bike },
  plane: { label: "Самолёт", icon: Plane },
  ship: { label: "Корабль", icon: Ship },
  train: { label: "Поезд", icon: TrainFront },
  wrench: { label: "Мастерская", icon: Wrench },
  hammer: { label: "Стройка", icon: Hammer },
  helmet: { label: "Работа", icon: HardHat },
  pickaxe: { label: "Шахта", icon: Pickaxe },
  food: { label: "Еда", icon: Utensils },
  coffee: { label: "Кафе", icon: Coffee },
  bar: { label: "Бар", icon: Beer },
  gym: { label: "Спорт", icon: Dumbbell },
  ticket: { label: "Развлечения", icon: Ticket },
  music: { label: "Музыка", icon: Music },
  game: { label: "Игры", icon: Gamepad2 },
  film: { label: "Кино", icon: Clapperboard },
  flag: { label: "Флаг", icon: Flag },
  star: { label: "Звезда", icon: Star },
  heart: { label: "Сердце", icon: Heart },
  key: { label: "Ключ", icon: Key },
  mail: { label: "Почта", icon: Mail },
  phone: { label: "Телефон", icon: Phone },
  school: { label: "Учёба", icon: GraduationCap },
  warehouse: { label: "Склад", icon: Warehouse },
  factory: { label: "Завод", icon: Factory },
  tractor: { label: "Ферма", icon: Tractor },
  fish: { label: "Рыбалка", icon: Fish },
  tree: { label: "Лес", icon: TreePine },
  mountain: { label: "Горы", icon: Mountain },
  anchor: { label: "Порт", icon: Anchor },
  skull: { label: "Опасно", icon: Skull },
  package: { label: "Посылка", icon: Package },
  zap: { label: "Энергия", icon: Zap },
  flame: { label: "Огонь", icon: Flame },
  camera: { label: "Камера", icon: Camera },
  paw: { label: "Животные", icon: PawPrint },
  scissors: { label: "Салон", icon: Scissors },
  pill: { label: "Аптека", icon: Pill },
  bed: { label: "Отель", icon: BedDouble },
};

const sizes = {
  /** Метка на карте */
  sm: { box: "size-6", image: "size-8", glyph: "size-3.5" },
  /** Метка в редакторе и в выбранном состоянии */
  md: { box: "size-7", image: "size-9", glyph: "size-4" },
  /** Значок в списках и карточках */
  lg: { box: "size-10", image: "size-10", glyph: "size-5" },
  xl: { box: "size-11", image: "size-11", glyph: "size-5" },
} as const;

export type MarkerBadgeSize = keyof typeof sizes;

/**
 * Значок метки: своя картинка, готовая иконка или иконка категории.
 * Картинка заполняет круг целиком, а готовая иконка стоит на цветном фоне категории.
 * Форму (rounded-*), кольцо и анимацию задаёт вызывающий код через className.
 */
export function MarkerBadge({
  category,
  icon,
  size = "lg",
  bare = false,
  className,
}: {
  category: PlaceCategoryId;
  icon?: string;
  size?: MarkerBadgeSize;
  /** Для своей картинки на карте: без круга, подложки и обрезки, ровно 20×20 */
  bare?: boolean;
  className?: string;
}) {
  const metrics = sizes[size];

  if (isPlaceIconImage(icon) && bare) {
    return (
      <span className={cn("flex size-5 shrink-0 items-center justify-center", className)}>
        {/* biome-ignore lint/performance/noImgElement: размеры своей иконки заранее неизвестны, next/image здесь не подходит */}
        <img src={icon ?? ""} alt="" draggable={false} loading="lazy" className="size-full object-contain" />
      </span>
    );
  }

  if (isPlaceIconImage(icon)) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden bg-background",
          metrics.image,
          className,
        )}
      >
        {/* biome-ignore lint/performance/noImgElement: размеры своей иконки заранее неизвестны, next/image здесь не подходит */}
        <img src={icon ?? ""} alt="" draggable={false} loading="lazy" className="size-full object-cover" />
      </span>
    );
  }

  const found = getCategory(category);
  const Icon = isPlaceIconPreset(icon) ? placeIconPresets[icon].icon : found.icon;
  return (
    <span className={cn("flex shrink-0 items-center justify-center", found.dotClass, metrics.box, className)}>
      <Icon aria-hidden="true" className={metrics.glyph} />
    </span>
  );
}
