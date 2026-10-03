"use client";

import { useState } from "react";

import { cn } from "cn";
import { Check } from "lucide-react";

import { type PaintColor, paintColors } from "../_data/vehicles";

export function VehiclePaint({ colors = paintColors }: { colors?: PaintColor[] }) {
  const [selected, setSelected] = useState<PaintColor | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const active = selected?.hex === color.hex;
          return (
            <li key={color.hex} className="size-8">
              <button
                type="button"
                title={color.name}
                aria-label={color.name}
                aria-pressed={active}
                onClick={() => setSelected(active ? null : color)}
                className={cn(
                  "relative flex size-full items-center justify-center rounded-md border outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50",
                  active && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                )}
                style={{ backgroundColor: color.hex }}
              >
                {active && <Check className="size-4 text-white mix-blend-difference" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {selected ? (
          <>
            Выбран цвет: <span className="font-medium text-foreground">{selected.name}</span>
          </>
        ) : (
          "Выберите цвет, чтобы посмотреть название"
        )}
      </p>
    </div>
  );
}
