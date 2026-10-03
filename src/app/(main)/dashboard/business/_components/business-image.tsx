import Image from "next/image";

import {
  Banknote,
  CarFront,
  Crosshair,
  Droplets,
  Fuel,
  Hammer,
  PenLine,
  Scissors,
  Shirt,
  Store,
  Wrench,
} from "lucide-react";

import type { Business, BusinessCategory } from "../_data/businesses";
import { businessTitle } from "../_data/businesses";

export const categoryIcons: Record<BusinessCategory, typeof Store> = {
  "Магазин 24/7": Store,
  Заправка: Fuel,
  Банкомат: Banknote,
  "Оружейный магазин": Crosshair,
  "Магазин одежды": Shirt,
  Автосалон: CarFront,
  "Тату-салон": PenLine,
  "Тюнинг салон": Wrench,
  Барбершоп: Scissors,
  Автомойка: Droplets,
  Автомастерские: Hammer,
};

/** Фото бизнеса сверху карточки. Если фото ещё нет — заглушка с иконкой типа. */
export function BusinessImage({ business }: { business: Business }) {
  const Icon = categoryIcons[business.category];

  return (
    <div className="relative aspect-[16/9] overflow-hidden border-b bg-gradient-to-b from-muted/70 to-muted/20">
      {business.imageUrl ? (
        <Image
          src={business.imageUrl}
          alt={businessTitle(business)}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          unoptimized
          className="object-cover transition-transform duration-300 group-hover/business:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
          <Icon className="size-1/3 stroke-[1]" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
