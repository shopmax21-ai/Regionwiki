import { Card } from "@/components/ui/card";

import { type Business, businessTitle, formatPrice } from "../_data/businesses";
import { BusinessImage } from "./business-image";

export function BusinessCard({ business }: { business: Business }) {
  return (
    <Card className="group/business h-full gap-0 py-0 transition-shadow hover:ring-primary/50">
      <BusinessImage business={business} />

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="truncate font-semibold tracking-tight">{businessTitle(business)}</h2>
        <p className="shrink-0 font-semibold tabular-nums">{formatPrice(business.price)}</p>
      </div>

      <div className="flex items-center gap-1.5 border-t px-4 py-3 text-sm text-muted-foreground">
        <span
          className="flex h-4 items-center rounded-[3px] bg-muted-foreground/70 px-1 text-[10px] leading-none font-bold text-card"
          aria-hidden="true"
        >
          ID
        </span>
        <span className="sr-only">ID:</span>
        {business.id}
      </div>
    </Card>
  );
}
