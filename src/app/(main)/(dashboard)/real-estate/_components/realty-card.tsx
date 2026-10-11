import type { ReactNode } from "react";

import { Users, Warehouse } from "lucide-react";

import { Card } from "@/components/ui/card";

import { formatPrice, type Realty, realtyTitle } from "../_data/realties";
import { RealtyImage } from "./realty-image";

type RealtyCardProps = {
  realty: Realty;
  /** Свой блок вместо фото: в редакторе сюда ставится поле загрузки картинки */
  image?: ReactNode;
  /** Кнопки редактирования и удаления: показываются в углу фото */
  actions?: ReactNode;
};

export function RealtyCard({ realty, image, actions }: RealtyCardProps) {
  return (
    <Card className="group/realty relative h-full gap-0 py-0 transition-shadow hover:ring-primary/50">
      {image ?? <RealtyImage realty={realty} />}
      {actions && <div className="absolute top-2 right-2 z-10 flex gap-1">{actions}</div>}

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="truncate font-semibold tracking-tight">{realtyTitle(realty)}</h2>
        <p className="shrink-0 font-semibold tabular-nums">{formatPrice(realty.price)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="flex h-4 items-center rounded-[3px] bg-muted-foreground/70 px-1 text-[10px] leading-none font-bold text-card"
            aria-hidden="true"
          >
            ID
          </span>
          <span className="sr-only">ID:</span>
          {realty.id}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="size-4" aria-hidden="true" />
          <span className="sr-only">Жильцов:</span>
          {realty.residents}
        </span>
        <span className="flex items-center gap-1.5">
          <Warehouse className="size-4" aria-hidden="true" />
          <span className="sr-only">Гаражных мест:</span>
          {realty.garage}
        </span>
      </div>
    </Card>
  );
}
