import Link from "next/link";

import { Fuel, Gauge, Weight, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { formatPrice, formatTrunk, type Vehicle } from "../_data/vehicles";
import { VehicleImage } from "./vehicle-image";

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const [mainSource, ...otherSources] = vehicle.sources;

  return (
    <Link
      href={`/dashboard/transport/${vehicle.code}`}
      className="group/vehicle block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`${vehicle.name} ${vehicle.model} — подробнее`}
    >
      <Card className="h-full gap-0 py-0 transition-shadow group-hover/vehicle:ring-primary/50">
        <div className="relative">
          <VehicleImage
            vehicle={vehicle}
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="aspect-[16/10] border-b"
            imageClassName="transition-transform duration-300 group-hover/vehicle:scale-105"
          />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {vehicle.isNew && <Badge>Новый</Badge>}
            {vehicle.nitro && (
              <Badge variant="secondary">
                <Zap data-icon="inline-start" /> Нитро
              </Badge>
            )}
            {vehicle.driftChip && <Badge variant="secondary">Дрифт-чип</Badge>}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{vehicle.name}</p>
            <h2 className="truncate text-xl font-semibold tracking-tight">{vehicle.model}</h2>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Скорость</dt>
              <dd className="font-medium">{vehicle.speed} км/ч</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Макс. скорость (FT)</dt>
              <dd className="font-medium">{vehicle.tunedSpeed} км/ч</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Гос. стоимость</dt>
              <dd className="text-lg font-semibold">{formatPrice(vehicle.price)}</dd>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="outline">{mainSource}</Badge>
                {otherSources.length > 0 && <Badge variant="outline">ещё {otherSources.length}</Badge>}
              </div>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Gauge className="size-3.5" aria-hidden="true" />
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
