"use client";

import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

import { formatPrice } from "../_data/vehicles";

export type PriceRange = [number, number];

// Ползунок логарифмический: цены от тысяч до десятков миллионов, на линейной шкале дешёвый транспорт не выбрать.
const STEPS = 1000;

function toPrice(position: number, min: number, max: number) {
  if (position <= 0) return min;
  if (position >= STEPS) return max;
  const raw = min * (max / min) ** (position / STEPS);
  const unit = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1);
  return Math.min(max, Math.max(min, Math.round(raw / unit) * unit));
}

function toPosition(price: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.round((Math.log(price / min) / Math.log(max / min)) * STEPS);
}

type PriceRangeFilterProps = {
  min: number;
  max: number;
  value: PriceRange;
  onChange: (value: PriceRange) => void;
  className?: string;
};

export function PriceRangeFilter({ min, max, value, onChange, className }: PriceRangeFilterProps) {
  const [low, high] = value;
  const isDefault = low <= min && high >= max;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`h-10 gap-2 px-3 ${className ?? ""}`}>
          <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
          {isDefault ? "Диапазон цены" : `${formatPrice(low)} – ${formatPrice(high)}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Диапазон цены</h2>
          {!isDefault && (
            <Button variant="ghost" size="xs" onClick={() => onChange([min, max])}>
              Сбросить
            </Button>
          )}
        </div>
        <Slider
          min={0}
          max={STEPS}
          step={1}
          minStepsBetweenThumbs={1}
          value={[toPosition(low, min, max), toPosition(high, min, max)]}
          onValueChange={([from, to]) => onChange([toPrice(from, min, max), toPrice(to, min, max)])}
          aria-label="Диапазон цены"
        />
        <div className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
          <span className="rounded-md bg-primary px-2 py-1 text-primary-foreground">{formatPrice(low)}</span>
          <span className="rounded-md bg-primary px-2 py-1 text-primary-foreground">{formatPrice(high)}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
