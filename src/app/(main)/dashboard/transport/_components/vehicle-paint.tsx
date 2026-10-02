"use client";

import { useState } from "react";

import { cn } from "cn";
import { Check } from "lucide-react";

import { type PaintColor, paintColors } from "../_data/vehicles";

export function VehiclePaint({ colors = paintColors }: { colors?: PaintColor[] }) {
  const [selected, setSelected] = useState<PaintColor | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-5 gap-3 sm:grid-cols-8 lg:grid-cols-10">
        {colors.map((color) => {
          const active = selected?.hex === color.hex;
          return (
            <li key={color.hex}>
              <button
                type="button"
                title={color.name}
                aria-label={color.name}
                aria-pressed={active}
                onClick={() => setSelected(active ? null : color)}
                className={cn(
                  "relative flex aspect-square w-full items-center justify-center rounded-full border outline-none transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50",
                  active && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                )}
                style={{ backgroundColor: color.hex }}
              >
                {active && <Check className="size-5 text-white mix-blend-difference" aria-hidden="true" />}
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
