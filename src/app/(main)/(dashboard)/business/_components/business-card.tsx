import type { ReactNode } from "react";

import Link from "next/link";

import { MapPin } from "lucide-react";

import { Card } from "@/components/ui/card";

import { type Business, businessMapHref, businessTitle, formatPrice } from "../_data/businesses";
import { BusinessImage } from "./business-image";

type BusinessCardProps = {
  business: Business;
  /** Свой блок вместо фото: в редакторе сюда ставится поле загрузки картинки */
  image?: ReactNode;
  /** Кнопки редактирования и удаления: показываются в углу фото */
  actions?: ReactNode;
};

export function BusinessCard({ business, image, actions }: BusinessCardProps) {
  const mapHref = businessMapHref(business);

  return (
    <Card className="group/business relative h-full gap-0 py-0 transition-shadow hover:ring-primary/50">
      {image ?? <BusinessImage business={business} />}
      {actions && <div className="absolute top-2 right-2 z-10 flex gap-1">{actions}</div>}

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="truncate font-semibold tracking-tight">{businessTitle(business)}</h2>
        <p className="shrink-0 font-semibold tabular-nums">{formatPrice(business.price)}</p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="flex h-4 items-center rounded-[3px] bg-muted-foreground/70 px-1 text-[10px] leading-none font-bold text-card"
            aria-hidden="true"
          >
            ID
          </span>
          <span className="sr-only">ID:</span>
          {business.id}
        </span>
        {mapHref && (
          <Link
            href={mapHref}
            prefetch={false}
            className="inline-flex items-center gap-1 rounded-md font-medium text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <MapPin className="size-4" aria-hidden="true" /> На карте
          </Link>
        )}
      </div>
    </Card>
  );
}
