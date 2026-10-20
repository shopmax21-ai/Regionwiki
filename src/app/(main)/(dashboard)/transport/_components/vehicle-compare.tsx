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
      <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border bg-card/95 p-3 shadow-2xl shadow-black/20 backdrop-blur-xl sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
            <GitCompareArrows className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm font-semibold tracking-tight">Сравнение транспорта</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {selected.length}/{MAX_COMPARE}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5">
              {selected.map((vehicle) => (
                <div
                  key={vehicle.code}
                  className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg border bg-background/70 py-1 pr-1 pl-1"
                >
                  <VehicleImage
                    vehicle={vehicle}
                    sizes="40px"
                    className="size-7 shrink-0 rounded-md"
                    imageClassName="p-0.5"
                  />
                  <span className="max-w-28 truncate text-xs font-medium">{vehicle.model}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(vehicle.code)}
                    aria-label={`Убрать ${vehicleTitle(vehicle)}`}
                    className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {selected.length < MAX_COMPARE && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {ready ? "Добавьте ещё" : "Выберите ещё машину"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t pt-2 sm:border-t-0 sm:pt-0">
          <Button variant="ghost" size="sm" onClick={onClear} className="flex-1 sm:flex-none">
            Сбросить
          </Button>
          <Button size="sm" disabled={!ready} onClick={onOpen} className="flex-1 sm:flex-none">
            <GitCompareArrows data-icon="inline-start" />
            Открыть сравнение
          </Button>
        </div>
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
  {
    label: "Стоимость свалки",
    value: (v) => getScrapPrice(v),
    best: "max",
    render: (v) => formatPrice(getScrapPrice(v)),
  },
  { label: "Багажник", value: (v) => v.trunkKg, best: "max", render: (v) => `${v.trunkKg} кг` },
  {
    label: "Грузоподъёмность",
    value: (v) => v.loadTons ?? 0,
    best: "max",
    render: (v) => (v.loadTons ? `${v.loadTons} т` : "—"),
  },
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
      <DialogContent className="max-h-[min(92vh,52rem)] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b bg-muted/20 p-5 pr-12 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <GitCompareArrows className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-lg tracking-tight sm:text-xl">Сравнение транспорта</DialogTitle>
              <DialogDescription className="mt-1">
                Сопоставьте характеристики выбранных машин и найдите подходящую.
              </DialogDescription>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" /> Лучший показатель
            </span>
            <span>
              {vehicles.length} из {MAX_COMPARE} выбрано
            </span>
          </div>
        </DialogHeader>

        <div className="overflow-auto">
          <div className="min-w-[30rem] p-4 sm:min-w-[42rem] sm:p-6" style={{ ["--cols" as string]: cols }}>
            <div className="grid grid-cols-[7.5rem_repeat(var(--cols),minmax(0,1fr))] gap-x-2 gap-y-1 sm:grid-cols-[12rem_repeat(var(--cols),minmax(0,1fr))] sm:gap-x-3">
              <div className="flex items-end pb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Параметр
              </div>
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.code}
                  className="group relative flex min-w-0 flex-col items-center gap-2 rounded-2xl border bg-card p-2.5 text-center sm:p-3"
                >
                  <VehicleImage
                    vehicle={vehicle}
                    sizes="240px"
                    className="aspect-[16/10] w-full rounded-xl bg-muted/50"
                    imageClassName="p-2"
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(vehicle.code)}
                    aria-label={`Убрать ${vehicleTitle(vehicle)}`}
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg border bg-background/90 text-muted-foreground shadow-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                  <div className="min-w-0 w-full">
                    <p className="truncate text-xs text-muted-foreground">{vehicle.name}</p>
                    <p className="truncate text-sm font-semibold tracking-tight">{vehicle.model}</p>
                  </div>
                  {topWins > 0 && wins.get(vehicle.code) === topWins && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[0.65rem] font-medium text-amber-600 dark:text-amber-400">
                      <Trophy className="size-3" /> Лидер
                    </span>
                  )}
                </div>
              ))}

              {metrics.map((metric, index) => {
                const best = bestCodes(vehicles, metric);
                return (
                  <div key={metric.label} className="contents">
                    <div
                      className={cn(
                        "flex items-center border-b py-3 text-xs font-medium text-muted-foreground",
                        index === 0 && "border-t",
                      )}
                    >
                      {metric.label}
                    </div>
                    {vehicles.map((vehicle) => (
                      <div
                        key={vehicle.code}
                        className={cn(
                          "flex min-h-11 items-center justify-center border-b bg-muted/30 px-2 py-3 text-center text-sm font-medium tabular-nums",
                          index === 0 && "border-t",
                          best.has(vehicle.code) &&
                            "bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-300",
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
