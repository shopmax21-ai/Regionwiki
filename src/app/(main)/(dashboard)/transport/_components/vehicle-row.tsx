import Link from "next/link";

import { ExternalLink, Fuel, Weight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { formatPrice, formatTrunk, type Vehicle } from "../_data/vehicles";
import { VehicleImage } from "./vehicle-image";

/** Широкая карточка для режима «список»: фото, название, характеристики справа и строка с ID в подвале. */
export function VehicleRow({ vehicle }: { vehicle: Vehicle }) {
  const [mainSource, ...otherSources] = vehicle.sources;

  return (
    <Link
      href={`/transport/${vehicle.code}`}
      className="group/vehicle block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`${vehicle.name} ${vehicle.model} — подробнее`}
    >
      <Card className="gap-0 py-0 transition-shadow group-hover/vehicle:ring-primary/50">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:gap-5 sm:p-4">
          <div className="relative shrink-0 sm:w-56">
            <VehicleImage
              vehicle={vehicle}
              sizes="(max-width: 640px) 100vw, 224px"
              className="aspect-[16/10] rounded-lg border"
              imageClassName="p-3 transition-transform duration-300 group-hover/vehicle:scale-105"
            />
            {vehicle.isNew && <Badge className="absolute top-2 left-2">Новый</Badge>}
          </div>

          <div className="min-w-0 sm:flex-1 sm:self-center">
            <p className="truncate text-sm text-muted-foreground">{vehicle.name}</p>
            <h2 className="truncate text-xl font-semibold tracking-tight">{vehicle.model}</h2>
          </div>

          <div className="flex flex-col gap-3 sm:items-end sm:justify-between">
            <ExternalLink
              className="hidden size-5 text-muted-foreground transition-colors group-hover/vehicle:text-foreground sm:block"
              aria-hidden="true"
            />
            <dl className="grid grid-cols-3 gap-x-4 text-right sm:gap-x-8">
              <div>
                <dt className="text-xs text-muted-foreground">Скорость</dt>
                <dd className="text-base font-semibold whitespace-nowrap tabular-nums sm:text-xl">
                  {vehicle.speed} км/ч
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Макс. скорость (FT)</dt>
                <dd className="text-base font-semibold whitespace-nowrap tabular-nums sm:text-xl">
                  {vehicle.tunedSpeed} км/ч
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Гос. стоимость</dt>
                <dd className="text-base font-semibold whitespace-nowrap tabular-nums sm:text-xl">
                  {formatPrice(vehicle.price)}
                </dd>
                <dd className="text-xs text-muted-foreground">
                  {mainSource}
                  {otherSources.length > 0 && ` · ещё ${otherSources.length}`}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-3 text-xs text-muted-foreground sm:px-4">
          <span className="flex items-center gap-1.5">
            <span
              className="flex h-3.5 items-center rounded-[3px] bg-muted-foreground/70 px-1 text-[9px] leading-none font-bold text-card"
              aria-hidden="true"
            >
              ID
            </span>
            <span className="sr-only">ID:</span>
            {vehicle.code}
          </span>
          <span className="flex items-center gap-1.5">
            <Fuel className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Топливо:</span>
            {vehicle.fuel}
          </span>
          <span className="flex items-center gap-1.5">
            <Weight className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Багажник:</span>
            {formatTrunk(vehicle)}
          </span>
        </div>
      </Card>
    </Link>
  );
}
