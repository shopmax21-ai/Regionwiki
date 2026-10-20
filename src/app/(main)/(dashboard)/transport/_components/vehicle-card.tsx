import Link from "next/link";

import { cn } from "cn";
import { Fuel, Gauge, Package, Weight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { formatPrice, formatTrunk, type Vehicle } from "../_data/vehicles";
import { VehicleImage } from "./vehicle-image";

type VehicleCardViewProps = {
  vehicle: Vehicle;
  /** Что показать вместо обычной картинки. Нужно предпросмотру в редакторе: там картинку можно загрузить прямо в карточку. */
  image?: React.ReactNode;
  className?: string;
};

/** Внешний вид карточки каталога. Общий для самой карточки и предпросмотра в редакторе, чтобы они не расходились. */
export function VehicleCardView({ vehicle, image, className }: VehicleCardViewProps) {
  const [mainSource, ...otherSources] = vehicle.sources;

  return (
    <Card className={cn("h-full gap-0 py-0 transition-shadow", className)}>
      <div className="relative overflow-hidden rounded-t-xl bg-muted/30">
        {image ?? (
          <VehicleImage
            vehicle={vehicle}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="aspect-[16/9]"
            imageClassName="p-5 transition-transform duration-300 group-hover/vehicle:scale-105"
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {vehicle.isNew && <Badge>Новый</Badge>}
            {vehicle.driftChip && <Badge variant="secondary">Дрифт-чип</Badge>}
          </div>
          <span className="rounded-md border border-border/60 bg-background/80 px-1.5 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur-sm">
            {vehicle.code}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {vehicle.name}
            </p>
            <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight">{vehicle.model}</h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Цена</p>
            <p className="text-sm font-semibold tabular-nums">{formatPrice(vehicle.price)}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 divide-x rounded-xl border bg-muted/30 py-2.5">
          <div className="px-3">
            <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Gauge className="size-3.5" aria-hidden="true" /> Скорость
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums">
              {vehicle.speed} <span className="text-xs font-normal text-muted-foreground">км/ч</span>
            </dd>
          </div>
          <div className="px-3">
            <dt className="text-[11px] text-muted-foreground">Макс. скорость FT</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums">
              {vehicle.tunedSpeed} <span className="text-xs font-normal text-muted-foreground">км/ч</span>
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Fuel className="size-3.5" aria-hidden="true" />
            {vehicle.fuel}
          </span>
          <span className="flex items-center gap-1.5">
            <Package className="size-3.5" aria-hidden="true" />
            {formatTrunk(vehicle)}
          </span>
          <span className="flex items-center gap-1.5">
            <Weight className="size-3.5" aria-hidden="true" />
            {vehicle.category}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span className="truncate">
            {mainSource ?? "Источник не указан"}
            {otherSources.length > 0 ? ` · ещё ${otherSources.length}` : ""}
          </span>
          <span className="shrink-0 font-medium text-foreground">Подробнее →</span>
        </div>
      </div>
    </Card>
  );
}

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Link
      href={`/transport/${vehicle.code}`}
      className="group/vehicle block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`${vehicle.name} ${vehicle.model} — подробнее`}
    >
      <VehicleCardView vehicle={vehicle} className="group-hover/vehicle:ring-primary/50" />
    </Link>
  );
}
