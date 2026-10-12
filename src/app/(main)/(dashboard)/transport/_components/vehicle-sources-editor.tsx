"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import type { Vehicle } from "../_data/vehicles";
import { TagInput } from "./tag-input";
import { LIMITS } from "./vehicle-form";

/**
 * Источники получения прямо на странице транспорта: добавление и удаление сохраняются сразу,
 * без открытия полной формы редактирования. Только для тех, у кого есть право «Редактирование транспорта».
 */
export function VehicleSourcesEditor({ vehicle, suggestions }: { vehicle: Vehicle; suggestions: string[] }) {
  const router = useRouter();
  const [values, setValues] = useState(vehicle.sources);
  const [saving, setSaving] = useState(false);

  const save = async (next: string[]) => {
    const previous = values;
    setValues(next);
    setSaving(true);
    try {
      const response = await fetch(`/api/vehicles/${vehicle.code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...vehicle, sources: next }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Не удалось сохранить");
      }
      toast.success("Источники сохранены");
      router.refresh();
    } catch (error) {
      setValues(previous);
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div aria-busy={saving} className={saving ? "pointer-events-none opacity-70" : undefined}>
      <TagInput
        id="vehicle-sources"
        values={values}
        onChange={save}
        suggestions={suggestions}
        placeholder="Кейс, салон, магазин..."
        maxItems={LIMITS.sources}
        maxLength={LIMITS.source}
      />
      <p className="mt-2 text-muted-foreground text-xs">
        Enter или запятая добавляют источник, крестик убирает. Изменения сохраняются сразу.
      </p>
    </div>
  );
}
