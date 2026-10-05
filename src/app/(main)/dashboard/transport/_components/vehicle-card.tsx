import Link from "next/link";

import { cn } from "cn";
import { Fuel, Weight } from "lucide-react";

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
      <div className="relative">
        {image ?? (
          <VehicleImage
            vehicle={vehicle}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="aspect-[16/9] border-b"
            imageClassName="p-4 transition-transform duration-300 group-hover/vehicle:scale-105"
          />
        )}
        <div className="pointer-events-none absolute top-2 left-2 flex flex-wrap gap-1">
          {vehicle.isNew && <Badge>Новый</Badge>}
          {vehicle.driftChip && <Badge variant="secondary">Дрифт-чип</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{vehicle.name}</p>
          <h2 className="truncate text-base font-semibold tracking-tight">{vehicle.model}</h2>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
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
            <dd className="text-base font-semibold">{formatPrice(vehicle.price)}</dd>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {mainSource ? (
                <Badge variant="outline">{mainSource}</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Источник не указан
                </Badge>
              )}
              {otherSources.length > 0 && <Badge variant="outline">ещё {otherSources.length}</Badge>}
            </div>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
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
  );
}

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Link
      href={`/dashboard/transport/${vehicle.code}`}
      className="group/vehicle block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`${vehicle.name} ${vehicle.model} — подробнее`}
    >
      <VehicleCardView vehicle={vehicle} className="group-hover/vehicle:ring-primary/50" />
    </Link>
  );
}
