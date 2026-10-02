"use client";

import { Copy, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { getCategory, type MapPlace } from "./map-data";

interface PlaceCardProps {
  place: MapPlace;
  onClose: () => void;
}

export function PlaceCard({ place, onClose }: PlaceCardProps) {
  const category = getCategory(place.category);
  const Icon = category.icon;
  const coordinates = `${Math.round(place.x)}, ${Math.round(place.y)}`;

  const copyCoordinates = async () => {
    try {
      await navigator.clipboard.writeText(coordinates);
      toast.success("Координаты скопированы");
    } catch {
      toast.error("Не удалось скопировать координаты");
    }
  };

  return (
    <Card
      size="sm"
      className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:w-80"
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="font-medium text-base leading-tight">{place.name}</h2>
            <Badge variant="secondary">{category.label}</Badge>
          </div>
          <Button variant="ghost" className="-mt-1 -mr-1 size-10" aria-label="Закрыть" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
        <Button variant="outline" className="h-11 justify-between rounded-xl px-3 text-sm" onClick={copyCoordinates}>
          <span className="text-muted-foreground">Координаты</span>
          <span className="flex items-center gap-2 tabular-nums">
            {coordinates}
            <Copy className="size-4" />
          </span>
        </Button>
      </CardContent>
    </Card>
  );
}
