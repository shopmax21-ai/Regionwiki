import Image from "next/image";

import { cn } from "cn";
import { Bike, CarFront, Plane, Ship, Truck } from "lucide-react";

import type { Vehicle, VehicleCategory } from "../_data/vehicles";

export const categoryIcons: Record<VehicleCategory, typeof CarFront> = {
  Легковые: CarFront,
  Грузовые: Truck,
  Мототехника: Bike,
  Велосипеды: Bike,
  Вертолеты: Plane,
  Самолеты: Plane,
  "Водный транспорт": Ship,
};

type VehicleImageProps = {
  vehicle: Vehicle;
  sizes: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function VehicleImage({ vehicle, sizes, className, imageClassName, priority }: VehicleImageProps) {
  const Icon = categoryIcons[vehicle.category];

  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-b from-muted/70 to-muted/20", className)}>
      {vehicle.imageUrl ? (
        <Image
          src={vehicle.imageUrl}
          alt={`${vehicle.name} ${vehicle.model}`}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized
          className={cn("object-contain object-center p-6", imageClassName)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
          <Icon className="size-1/3 stroke-[1]" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
