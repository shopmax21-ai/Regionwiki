import Image from "next/image";

import {
  Apple,
  Backpack,
  BookOpen,
  Boxes,
  Building2,
  Cog,
  Cpu,
  Crosshair,
  Factory,
  FileText,
  Fish,
  FlaskConical,
  Layers,
  Package,
  Pill,
  Shapes,
  Shield,
  Shirt,
  Sparkles,
  Trash2,
  Wheat,
  Wine,
  Wrench,
} from "lucide-react";

import { Card } from "@/components/ui/card";

import type { Item, ItemCategory } from "../_data/items";

export type ItemCardView = "grid" | "list";

interface ItemCardProps {
  item: Item;
  view?: ItemCardView;
  onSelect?: (item: Item) => void;
}

export const categoryIcons: Record<ItemCategory, typeof Package> = {
  Продукты: Apple,
  Инструменты: Wrench,
  Рыба: Fish,
  Оборудование: Cpu,
  Алкоголь: Wine,
  Амуниция: Crosshair,
  Медицина: Pill,
  Автозапчасти: Cog,
  Прочее: Boxes,
  Расходники: Package,
  Инфраструктура: Building2,
  Документы: FileText,
  Книги: BookOpen,
  "Личные вещи": Backpack,
  Продукция: Factory,
  Материалы: Layers,
  Одежда: Shirt,
  Мусор: Trash2,
  "Сельское хозяйство": Wheat,
  Стафф: Sparkles,
  Ингредиенты: FlaskConical,
  Броня: Shield,
  Разное: Shapes,
};

/** Картинка предмета. Если её ещё нет, показывается иконка категории. */
function ItemImage({ item, view }: { item: Item; view: ItemCardView }) {
  const Icon = categoryIcons[item.category];

  return (
    <div
      className={
        view === "list"
          ? "relative size-16 shrink-0 overflow-hidden rounded-md bg-gradient-to-b from-muted/70 to-muted/20"
          : "relative aspect-square overflow-hidden border-b bg-gradient-to-b from-muted/70 to-muted/20"
      }
    >
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes={view === "list" ? "64px" : "(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"}
          unoptimized
          className="object-contain p-4 transition-transform duration-300 group-hover/item:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
          <Icon className="size-1/3 stroke-[1]" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

export function ItemCard({ item, view = "grid", onSelect }: ItemCardProps) {
  const isList = view === "list";

  return (
    <Card
      className={
        isList
          ? "group/item flex cursor-pointer flex-row items-center gap-3 p-3 transition-shadow hover:ring-primary/50"
          : "group/item h-full cursor-pointer gap-0 py-0 transition-shadow hover:ring-primary/50"
      }
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(item);
        }
      }}
    >
      <ItemImage item={item} view={view} />

      <div className={isList ? "min-w-0 flex-1" : "flex flex-col gap-0.5 px-3 py-3"}>
        <h2
          className={
            isList
              ? "truncate font-semibold leading-5 tracking-tight"
              : "line-clamp-2 min-h-10 font-semibold leading-5 tracking-tight"
          }
        >
          {item.name}
        </h2>
        <p className="truncate text-muted-foreground text-xs">{item.category}</p>
      </div>

      <div
        className={
          isList
            ? "flex shrink-0 items-center gap-1.5 text-muted-foreground text-sm"
            : "flex items-center gap-1.5 border-t px-3 py-2.5 text-muted-foreground text-sm"
        }
      >
        <span
          className="flex h-4 items-center rounded-[3px] bg-muted-foreground/70 px-1 font-bold text-[10px] text-card leading-none"
          aria-hidden="true"
        >
          ID
        </span>
        <span className="sr-only">ID:</span>
        {item.id}
      </div>
    </Card>
  );
}
