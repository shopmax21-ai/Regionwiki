"use client";

import { useState } from "react";

import Image from "next/image";

import { Building2, House, Store, Warehouse } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { Realty, RealtyCategory } from "../_data/realties";
import { realtyTitle } from "../_data/realties";

export const categoryIcons: Record<RealtyCategory, typeof House> = {
  Дома: House,
  Квартиры: Building2,
  Офисы: Store,
  Склады: Warehouse,
};

type View = "exterior" | "interior";

const viewLabels: Record<View, string> = { exterior: "Экстерьер", interior: "Интерьер" };

/** Большое фото сверху карточки. Если фото ещё нет — аккуратная заглушка с иконкой типа. */
export function RealtyImage({ realty }: { realty: Realty }) {
  const sources: Partial<Record<View, string>> = { exterior: realty.exteriorUrl, interior: realty.interiorUrl };
  const views = (Object.keys(viewLabels) as View[]).filter((view) => sources[view]);
  const [selected, setSelected] = useState<View>(views[0] ?? "exterior");

  const view = views.includes(selected) ? selected : views[0];
  const src = view ? sources[view] : undefined;
  const Icon = categoryIcons[realty.category];

  return (
    <div className="relative aspect-[16/9] overflow-hidden border-b bg-gradient-to-b from-muted/70 to-muted/20">
      {src ? (
        <Image
          src={src}
          alt={`${realtyTitle(realty)} — ${viewLabels[view].toLowerCase()}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          unoptimized
          className="object-cover transition-transform duration-300 group-hover/realty:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
          <Icon className="size-1/3 stroke-[1]" aria-hidden="true" />
        </div>
      )}

      {views.length > 1 && (
        <fieldset className="absolute bottom-3 left-3 m-0 flex gap-1 rounded-lg border-0 bg-background/70 p-1 ring-1 ring-foreground/10 backdrop-blur">
          <legend className="sr-only">Вид объекта</legend>
          {views.map((item) => (
            <Button
              key={item}
              size="xs"
              variant={item === view ? "default" : "ghost"}
              aria-pressed={item === view}
              className={item === view ? undefined : "text-muted-foreground"}
              onClick={() => setSelected(item)}
            >
              {viewLabels[item]}
            </Button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
