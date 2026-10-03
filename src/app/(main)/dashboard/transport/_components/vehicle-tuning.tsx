"use client";

import { useState } from "react";

import { cn } from "cn";
import { Cog, Disc3, type LucideIcon, Minus, Plus, Rocket, RotateCcw, Settings2, Wind, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { formatPrice, type VehicleUpgrade } from "../_data/vehicles";

const upgradeIcons: Record<string, LucideIcon> = {
  Двигатель: Cog,
  Коробка: Settings2,
  Турбо: Wind,
  Тормоза: Disc3,
};

const sumLevels = (upgrade: VehicleUpgrade, count: number) =>
  upgrade.levels.slice(0, count).reduce((sum, level) => sum + level.price, 0);

export function VehicleTuning({ upgrades }: { upgrades: VehicleUpgrade[] }) {
  const [selected, setSelected] = useState<Record<string, number>>({});

  const levelOf = (upgrade: VehicleUpgrade) => selected[upgrade.name] ?? 0;
  const setLevel = (upgrade: VehicleUpgrade, value: number) =>
    setSelected((prev) => ({ ...prev, [upgrade.name]: Math.min(Math.max(value, 0), upgrade.levels.length) }));

  const total = upgrades.reduce((sum, upgrade) => sum + sumLevels(upgrade, levelOf(upgrade)), 0);
  const maxTotal = upgrades.reduce((sum, upgrade) => sum + sumLevels(upgrade, upgrade.levels.length), 0);
  const isEmpty = total === 0;
  const isMax = total === maxTotal;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isMax}
          onClick={() => setSelected(Object.fromEntries(upgrades.map((item) => [item.name, item.levels.length])))}
        >
          <Rocket data-icon="inline-start" /> Всё на максимум
        </Button>
        <Button variant="outline" size="sm" disabled={isEmpty} onClick={() => setSelected({})}>
          <RotateCcw data-icon="inline-start" /> Сбросить
        </Button>
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {upgrades.map((upgrade) => {
          const level = levelOf(upgrade);
          const max = upgrade.levels.length;
          const cost = sumLevels(upgrade, level);
          const next = upgrade.levels[level];
          const Icon = upgradeIcons[upgrade.name] ?? Wrench;
          const bonus = upgrade.levels.slice(0, level).findLast((item) => item.bonus)?.bonus;

          return (
            <li
              key={upgrade.name}
              className={cn(
                "relative flex flex-col gap-4 overflow-hidden rounded-xl border p-4 transition-colors",
                level > 0 ? "border-primary/40 bg-muted/40" : "bg-card",
              )}
            >
              <Icon
                className="pointer-events-none absolute right-2.5 bottom-2.5 size-12 stroke-[1.25] text-foreground/10"
                aria-hidden="true"
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium">{upgrade.name}</h3>
                  <p className="text-sm text-muted-foreground">{upgrade.description}</p>
                </div>
                {bonus && <Badge variant="secondary">{bonus}</Badge>}
              </div>

              <div className="relative flex items-center gap-1.5" role="img" aria-label={`Уровень ${level} из ${max}`}>
                {upgrade.levels.map((item, index) => (
                  <span
                    key={item.price + String(index)}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      index < level ? "bg-primary" : "bg-muted",
                    )}
                  />
                ))}
              </div>

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`${upgrade.name}: убрать уровень`}
                    disabled={level === 0}
                    onClick={() => setLevel(upgrade, level - 1)}
                  >
                    <Minus />
                  </Button>
                  <span className="min-w-16 text-center text-sm tabular-nums">
                    {level} / {max}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`${upgrade.name}: добавить уровень`}
                    disabled={level === max}
                    onClick={() => setLevel(upgrade, level + 1)}
                  >
                    <Plus />
                  </Button>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatPrice(cost)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {next ? `след. уровень ${formatPrice(next.price)}` : "максимум"}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-1 border-t pt-4">
        <div className="flex items-center justify-between gap-4">
          <span className="font-medium">Стоимость улучшений</span>
          <span className="text-xl font-semibold tabular-nums" aria-live="polite">
            {formatPrice(total)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Полный комплект — {formatPrice(maxTotal)}. Итоговая стоимость может отличаться из-за комиссии тюнинг-салона на
          вашем сервере
        </p>
      </div>
    </div>
  );
}
