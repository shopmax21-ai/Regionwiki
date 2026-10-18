"use client";

import { useId } from "react";

import { Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { JOB_LIMITS, type Job } from "../_data/jobs";

type JobAccessEditorProps = {
  /** Уровень персонажа строкой: пустое поле значит «доступна сразу» */
  level: string;
  /** Предыдущие этапы (slug): до двух работ */
  altRanks: string[];
  /** Работы, из которых можно выбрать предыдущий этап */
  options: Job[];
  onLevelChange: (level: string) => void;
  onAltRanksChange: (altRanks: string[]) => void;
};

/** Условия доступа прямо на странице гайда: уровень персонажа и альтернативный путь через 2 ранг на другой работе. */
export function JobAccessEditor({ level, altRanks, options, onLevelChange, onAltRanksChange }: JobAccessEditorProps) {
  const fieldId = useId();

  const setAlt = (index: number, slug: string) => {
    const next = [altRanks[0] ?? "", altRanks[1] ?? ""];
    next[index] = slug;
    onAltRanksChange(next.filter((item, i, all) => item && all.indexOf(item) === i));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldId}-level`} className="gap-2">
          <Lock className="size-4 text-primary" aria-hidden="true" /> Уровень персонажа
        </Label>
        <Input
          id={`${fieldId}-level`}
          type="number"
          inputMode="numeric"
          min={0}
          max={JOB_LIMITS.level}
          value={level}
          onChange={(event) => onLevelChange(event.target.value)}
          className="w-full sm:w-40"
        />
        <p className="text-muted-foreground text-xs">Уровень 0 — работа доступна сразу после создания персонажа.</p>
      </div>

      <fieldset className="flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 font-medium text-sm">Альтернативный путь: 2 ранг на одной из работ</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1].map((index) => (
            <NativeSelect
              key={index}
              className="w-full"
              value={altRanks[index] ?? ""}
              aria-label={`Предыдущая работа ${index + 1}`}
              onChange={(event) => setAlt(index, event.target.value)}
            >
              <option value="">Не выбрано</option>
              {options.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.title}
                </option>
              ))}
            </NativeSelect>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
