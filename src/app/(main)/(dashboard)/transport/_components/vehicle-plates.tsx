"use client";

import { useState } from "react";

import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { PlateDesign } from "../_data/vehicles";

const COLLAPSED_COUNT = 12;

export function VehiclePlates({ plates }: { plates: PlateDesign[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? plates : plates.slice(0, COLLAPSED_COUNT);
  const canExpand = plates.length > COLLAPSED_COUNT;

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((plate) => (
          <li key={plate.name} className="flex flex-col gap-1 rounded-lg border bg-muted/30 px-3 py-2.5">
            <span className="truncate text-sm font-medium">Номерной знак «{plate.name}»</span>
            {plate.source && <span className="truncate text-xs text-muted-foreground">{plate.source}</span>}
          </li>
        ))}
      </ul>
      {canExpand && (
        <Button
          variant="outline"
          className="self-center"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            <>
              <ChevronUp data-icon="inline-start" /> Свернуть
            </>
          ) : (
            <>
              <ChevronDown data-icon="inline-start" /> Показать все ({plates.length})
            </>
          )}
        </Button>
      )}
    </div>
  );
}
