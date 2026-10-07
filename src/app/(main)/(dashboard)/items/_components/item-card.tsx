import Image from "next/image";

import { cn } from "cn";
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
export function ItemImage({
  item,
  sizes,
  className,
  imageClassName,
}: {
  item: Item;
  sizes: string;
  className?: string;
  imageClassName?: string;
}) {
  const Icon = categoryIcons[item.category];

  return (
    <div className={cn("relative aspect-square overflow-hidden bg-gradient-to-b from-muted/70 to-muted/20", className)}>
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes={sizes}
          unoptimized
          className={cn("object-contain p-4", imageClassName)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
          <Icon className="size-1/3 stroke-[1]" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

/** Значок «ID» и номер предмета: такой же, как в карточках транспорта, бизнесов и недвижимости. */
export function ItemId({ id, className }: { id: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <span
        className="flex h-4 items-center rounded-[3px] bg-muted-foreground/70 px-1 font-bold text-[10px] text-card leading-none"
        aria-hidden="true"
      >
        ID
      </span>
      <span className="sr-only">ID:</span>
      {id}
    </span>
  );
}

export function ItemCard({ item, onOpen }: { item: Item; onOpen: (item: Item) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`${item.name}, ${item.category}. Открыть подробности`}
      className="group/item block h-full rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full gap-0 py-0 transition-shadow group-hover/item:ring-primary/50">
        <ItemImage
          item={item}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          className="border-b"
          imageClassName="transition-transform duration-300 group-hover/item:scale-105"
        />

        <div className="flex flex-col gap-0.5 px-3 py-3">
          <h2 className="line-clamp-2 min-h-10 font-semibold leading-5 tracking-tight">{item.name}</h2>
          <p className="truncate text-muted-foreground text-xs">{item.category}</p>
        </div>

        <ItemId id={item.id} className="border-t px-3 py-2.5 text-muted-foreground text-sm" />
      </Card>
    </button>
  );
}
