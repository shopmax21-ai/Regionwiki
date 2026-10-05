"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { formatPrice } from "../_data/vehicles";
import { Field, fieldId } from "./vehicle-field";
import {
  digitsOnly,
  emptyLevel,
  emptyUpgrade,
  groupDigits,
  LIMITS,
  levelField,
  parseLevelLines,
  type UpgradeForm,
  upgradeLevelsField,
  upgradeNameField,
} from "./vehicle-form";

/** Типичные улучшения: добавляются одним нажатием вместе с первым уровнем */
const SUGGESTED = ["Двигатель", "Тормоза", "Коробка", "Турбо"];

type VehicleUpgradesEditorProps = {
  upgrades: UpgradeForm[];
  onChange: (upgrades: UpgradeForm[]) => void;
  errors: Record<string, string>;
  clearError: (field: string) => void;
};

/** Улучшения: у каждого свои уровни в виде строк «цена + бонус» вместо текста с разделителями. */
export function VehicleUpgradesEditor({ upgrades, onChange, errors, clearError }: VehicleUpgradesEditorProps) {
  const patch = (index: number, changes: Partial<UpgradeForm>) =>
    onChange(upgrades.map((upgrade, i) => (i === index ? { ...upgrade, ...changes } : upgrade)));

  const free = SUGGESTED.filter(
    (name) => !upgrades.some((upgrade) => upgrade.name.trim().toLowerCase() === name.toLowerCase()),
  );
  const canAdd = upgrades.length < LIMITS.upgrades;

  return (
    <div className="flex flex-col gap-3">
      {upgrades.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground text-xs">
          Улучшений пока нет. Добавьте то, что можно поставить на этот транспорт.
        </p>
      )}

      {upgrades.map((upgrade, index) => {
        const total = upgrade.levels.reduce((sum, level) => sum + (Number(level.price) || 0), 0);
        const nameId = upgradeNameField(index);
        return (
          <div key={upgrade.key} className="flex flex-col gap-3 rounded-xl border p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-start">
              <Field id={nameId} label="Название" error={errors[nameId]}>
                <Input
                  id={fieldId(nameId)}
                  value={upgrade.name}
                  maxLength={LIMITS.upgradeName}
                  aria-invalid={Boolean(errors[nameId])}
                  placeholder="Двигатель"
                  onChange={(event) => {
                    clearError(nameId);
                    patch(index, { name: event.target.value });
                  }}
                />
              </Field>
              <Field id={`upgrade-${index}-description`} label="Описание">
                <Input
                  id={fieldId(`upgrade-${index}-description`)}
                  value={upgrade.description}
                  maxLength={LIMITS.upgradeDescription}
                  placeholder="Увеличивает максимальную скорость"
                  onChange={(event) => patch(index, { description: event.target.value })}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive sm:mt-6"
                aria-label={`Убрать улучшение «${upgrade.name || index + 1}»`}
                onClick={() => onChange(upgrades.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Уровни улучшения «{upgrade.name}»</legend>
              {upgrade.levels.map((level, levelIndex) => {
                const field = levelField(index, levelIndex);
                const setLevel = (changes: Partial<typeof level>) =>
                  patch(index, {
                    levels: upgrade.levels.map((item, i) => (i === levelIndex ? { ...item, ...changes } : item)),
                  });
                return (
                  <div key={level.key} className="flex flex-col gap-1">
                    <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 sm:grid-cols-[2.5rem_1fr_1fr_auto]">
                      <span className="text-muted-foreground text-xs tabular-nums">Ур. {levelIndex + 1}</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
                        <Input
                          id={fieldId(field)}
                          inputMode="numeric"
                          className="pl-6 tabular-nums"
                          value={groupDigits(level.price)}
                          aria-label={`Цена уровня ${levelIndex + 1}`}
                          aria-invalid={Boolean(errors[field])}
                          placeholder="Цена"
                          onChange={(event) => {
                            clearError(field);
                            setLevel({ price: digitsOnly(event.target.value, 11) });
                          }}
                          onPaste={(event) => {
                            // Список строк «цена | бонус» из таблицы или заметок раскладывается на уровни
                            const text = event.clipboardData.getData("text");
                            if (!text.includes("\n")) return;
                            const parsed = parseLevelLines(text);
                            if (parsed.length === 0) return;
                            event.preventDefault();
                            clearError(field);
                            const merged = [...upgrade.levels.slice(0, levelIndex), ...parsed].slice(0, LIMITS.levels);
                            patch(index, { levels: merged });
                          }}
                        />
                      </div>
                      <Input
                        className="col-span-2 col-start-2 sm:col-span-1 sm:col-start-auto"
                        value={level.bonus}
                        maxLength={LIMITS.bonus}
                        aria-label={`Бонус уровня ${levelIndex + 1}`}
                        placeholder="Бонус, например +20 км/ч"
                        onChange={(event) => setLevel({ bonus: event.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Убрать уровень ${levelIndex + 1}`}
                        disabled={upgrade.levels.length === 1}
                        onClick={() => patch(index, { levels: upgrade.levels.filter((_, i) => i !== levelIndex) })}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {errors[field] && (
                      <p role="alert" className="pl-10 text-destructive text-xs">
                        {errors[field]}
                      </p>
                    )}
                  </div>
                );
              })}
              {errors[upgradeLevelsField(index)] && (
                <p role="alert" className="text-destructive text-xs">
                  {errors[upgradeLevelsField(index)]}
                </p>
              )}
            </fieldset>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={upgrade.levels.length >= LIMITS.levels}
                onClick={() => patch(index, { levels: [...upgrade.levels, emptyLevel()] })}
              >
                <Plus data-icon="inline-start" /> Уровень
              </Button>
              {total > 0 && (
                <span className="text-muted-foreground text-xs">
                  Все уровни: <span className="font-medium text-foreground">{formatPrice(total)}</span>
                </span>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAdd}
          onClick={() => onChange([...upgrades, emptyUpgrade()])}
        >
          <Plus data-icon="inline-start" /> Добавить улучшение
        </Button>
        {canAdd &&
          free.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange([...upgrades, emptyUpgrade(name)])}
              className="flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-muted-foreground text-xs outline-none transition-colors hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3" aria-hidden="true" />
              {name}
            </button>
          ))}
      </div>
    </div>
  );
}
