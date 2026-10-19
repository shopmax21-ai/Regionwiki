"use client";

import { useState } from "react";

import { cn } from "cn";
import { Check, GitCompareArrows, Minus, Trophy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { formatPrice, getScrapPrice, type Vehicle, vehicleTitle } from "../_data/vehicles";
import { VehicleImage } from "./vehicle-image";

export const MAX_COMPARE = 3;

/** Кнопка «в сравнение» поверх карточки. Лежит рядом со ссылкой, а не внутри неё. */
export function CompareToggle({
  vehicle,
  selected,
  disabled,
  onToggle,
  className,
}: {
  vehicle: Vehicle;
  selected: boolean;
  disabled: boolean;
  onToggle: (code: string) => void;
  className?: string;
}) {
  const blocked = disabled && !selected;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${selected ? "Убрать из сравнения" : "Добавить в сравнение"}: ${vehicleTitle(vehicle)}`}
      title={blocked ? `Можно сравнить не больше ${MAX_COMPARE} машин` : undefined}
      disabled={blocked}
      onClick={() => onToggle(vehicle.code)}
      className={cn(
        "absolute z-10 flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background/80 text-foreground hover:bg-background",
        className,
      )}
    >
      {selected ? <Check className="size-3.5" /> : <GitCompareArrows className="size-3.5" />}
      {selected ? "В сравнении" : "Сравнить"}
    </button>
  );
}

/** Плавающая панель внизу: выбранные машины и кнопка «Сравнить». */
export function CompareBar({
  selected,
  onRemove,
  onClear,
  onOpen,
}: {
  selected: Vehicle[];
  onRemove: (code: string) => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  if (selected.length === 0) return null;
  const ready = selected.length >= 2;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border bg-card/95 p-2.5 shadow-xl backdrop-blur-md">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {selected.map((vehicle) => (
            <div
              key={vehicle.code}
              className="flex min-w-0 items-center gap-1.5 rounded-xl bg-muted/70 py-1 pr-1 pl-1"
            >
              <VehicleImage
                vehicle={vehicle}
                sizes="48px"
                className="hidden size-8 shrink-0 rounded-lg sm:block"
                imageClassName="p-0.5"
              />
              <span className="max-w-24 truncate pl-1 text-xs font-medium sm:pl-0">{vehicle.model}</span>
              <button
                type="button"
                onClick={() => onRemove(vehicle.code)}
                aria-label={`Убрать ${vehicleTitle(vehicle)}`}
                className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {selected.length < MAX_COMPARE && (
            <span className="hidden text-xs text-muted-foreground md:inline">
              {ready ? "можно добавить ещё" : "выберите ещё машину"}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="max-sm:hidden">
          Сбросить
        </Button>
        <Button size="sm" disabled={!ready} onClick={onOpen}>
          <GitCompareArrows data-icon="inline-start" />
          Сравнить
        </Button>
      </div>
    </div>
  );
}

type Metric = {
  label: string;
  /** Число для подсветки лучшего значения */
  value?: (v: Vehicle) => number;
  best?: "max" | "min";
  render: (v: Vehicle) => React.ReactNode;
};

const yesNo = (flag: boolean) =>
  flag ? (
    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
      <Check className="size-4" /> Да
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Minus className="size-4" /> Нет
    </span>
  );

const metrics: Metric[] = [
  { label: "Скорость", value: (v) => v.speed, best: "max", render: (v) => `${v.speed} км/ч` },
  { label: "Макс. скорость (FT)", value: (v) => v.tunedSpeed, best: "max", render: (v) => `${v.tunedSpeed} км/ч` },
  { label: "Гос. стоимость", value: (v) => v.price, best: "min", render: (v) => formatPrice(v.price) },
  { label: "Стоимость свалки", value: (v) => getScrapPrice(v), best: "max", render: (v) => formatPrice(getScrapPrice(v)) },
  { label: "Багажник", value: (v) => v.trunkKg, best: "max", render: (v) => `${v.trunkKg} кг` },
  { label: "Грузоподъёмность", value: (v) => v.loadTons ?? 0, best: "max", render: (v) => (v.loadTons ? `${v.loadTons} т` : "—") },
  { label: "Топливо", render: (v) => v.fuel },
  { label: "Категория", render: (v) => v.category },
  { label: "Источник", render: (v) => (v.sources.length ? v.sources.join(", ") : "Не указан") },
  { label: "Передача", render: (v) => yesNo(v.transferable) },
  { label: "Нитро", render: (v) => yesNo(v.nitro) },
  { label: "Дрифт-чип", render: (v) => yesNo(v.driftChip) },
];

function bestCodes(list: Vehicle[], metric: Metric): Set<string> {
  if (!metric.value || !metric.best) return new Set();
  const values = list.map((v) => metric.value!(v));
  const target = metric.best === "max" ? Math.max(...values) : Math.min(...values);
  // Если у всех одинаково, подсвечивать нечего
  if (values.every((x) => x === target)) return new Set();
  if (metric.label === "Грузоподъёмность" && target === 0) return new Set();
  return new Set(list.filter((v) => metric.value!(v) === target).map((v) => v.code));
}

export function CompareDialog({
  open,
  onOpenChange,
  vehicles,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  onRemove: (code: string) => void;
}) {
  const cols = vehicles.length;
  const wins = new Map<string, number>(vehicles.map((v) => [v.code, 0]));
  for (const m of metrics) for (const code of bestCodes(vehicles, m)) wins.set(code, (wins.get(code) ?? 0) + 1);
  const topWins = Math.max(0, ...wins.values());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GitCompareArrows className="size-4" />
            </span>
            Сравнение транспорта
          </DialogTitle>
          <DialogDescription>Лучшие значения отмечены зелёным.</DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <div className="min-w-[26rem] p-3 sm:min-w-[34rem] sm:p-4" style={{ ["--cols" as string]: cols }}>
            <div className="grid grid-cols-[5.5rem_repeat(var(--cols),minmax(0,1fr))] gap-2 sm:gap-3 sm:grid-cols-[10rem_repeat(var(--cols),minmax(0,1fr))]">
              <div />
              {vehicles.map((vehicle) => (
                <div key={vehicle.code} className="relative flex flex-col items-center gap-2 text-center">
                  <VehicleImage
                    vehicle={vehicle}
                    sizes="240px"
                    className="aspect-[16/10] w-full rounded-xl border"
                    imageClassName="p-2"
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(vehicle.code)}
                    aria-label={`Убрать ${vehicleTitle(vehicle)}`}
                    className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-lg border bg-background/80 text-muted-foreground backdrop-blur-sm hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{vehicle.name}</p>
                    <p className="truncate font-semibold tracking-tight">{vehicle.model}</p>
                  </div>
                  {topWins > 0 && wins.get(vehicle.code) === topWins && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.7rem] font-medium text-amber-600 dark:text-amber-400">
                      <Trophy className="size-3" /> Лучше по {topWins}
                    </span>
                  )}
                </div>
              ))}

              {metrics.map((metric) => {
                const best = bestCodes(vehicles, metric);
                return (
                  <div key={metric.label} className="contents">
                    <div className="flex items-center rounded-xl py-2.5 text-xs text-muted-foreground">{metric.label}</div>
                    {vehicles.map((vehicle) => (
                      <div
                        key={vehicle.code}
                        className={cn(
                          "flex items-center justify-center rounded-xl bg-muted/50 px-2 py-2.5 text-center text-sm font-medium tabular-nums",
                          best.has(vehicle.code) &&
                            "bg-emerald-500/15 font-semibold text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300",
                        )}
                      >
                        {metric.render(vehicle)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
