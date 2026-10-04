"use client";

import { useId } from "react";

import { cn } from "cn";
import { Crosshair, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { PLACE_LIMITS, type PlaceCategoryId, placeCategories } from "./map-data";

/** Метка в работе. Координаты хранятся строками, чтобы в полях можно было набирать «-» и «12.» */
export interface PlaceDraft {
  /** null — метка новая */
  id: string | null;
  name: string;
  category: PlaceCategoryId;
  description: string;
  x: string;
  y: string;
}

interface PlaceEditorProps {
  draft: PlaceDraft;
  onChange: (patch: Partial<PlaceDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}

/**
 * Форма добавления и изменения метки. Лежит внутри раздела карты, а не в диалоге-портале,
 * поэтому остаётся видимой и рабочей в полноэкранном режиме.
 */
export function PlaceEditor({ draft, onChange, onSave, onCancel, pending, error }: PlaceEditorProps) {
  const fieldId = useId();
  const creating = draft.id === null;
  const hasPosition = draft.x.trim() !== "" && draft.y.trim() !== "";

  return (
    <Card
      size="sm"
      className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 max-h-[70%] overflow-y-auto shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:max-h-[calc(100%-2rem)] md:w-80"
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium text-base leading-tight">{creating ? "Новая метка" : "Изменение метки"}</h2>
          <Button
            variant="ghost"
            className="-mt-1 -mr-1 size-10"
            aria-label="Закрыть без сохранения"
            onClick={onCancel}
            disabled={pending}
          >
            <X className="size-5" />
          </Button>
        </div>

        <p
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
            hasPosition ? "bg-muted text-muted-foreground" : "bg-primary/10 text-foreground",
          )}
        >
          <Crosshair aria-hidden="true" className="size-4 shrink-0" />
          {hasPosition ? "Нажмите на карту, чтобы переместить метку" : "Нажмите на карту, чтобы выбрать место метки"}
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-name`}>Название</Label>
          <Input
            id={`${fieldId}-name`}
            value={draft.name}
            maxLength={PLACE_LIMITS.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Например, Центральный банк"
            autoComplete="off"
          />
        </div>

        <fieldset className="flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 font-medium text-sm">Категория</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {placeCategories.map((category) => {
              const Icon = category.icon;
              const active = draft.category === category.id;
              return (
                <Button
                  key={category.id}
                  type="button"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  className="h-10 justify-start gap-2 px-2.5 text-sm"
                  onClick={() => onChange({ category: category.id })}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{category.label}</span>
                </Button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-x`}>X</Label>
            <Input
              id={`${fieldId}-x`}
              inputMode="decimal"
              value={draft.x}
              onChange={(event) => onChange({ x: event.target.value })}
              placeholder="0"
              autoComplete="off"
              className="tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-y`}>Y</Label>
            <Input
              id={`${fieldId}-y`}
              inputMode="decimal"
              value={draft.y}
              onChange={(event) => onChange({ y: event.target.value })}
              placeholder="0"
              autoComplete="off"
              className="tabular-nums"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-description`}>Описание</Label>
          <Textarea
            id={`${fieldId}-description`}
            value={draft.description}
            maxLength={PLACE_LIMITS.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Необязательно: что здесь находится, как пройти"
            className="max-h-40 min-h-16"
          />
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="h-10 flex-1" onClick={onCancel} disabled={pending}>
            Отмена
          </Button>
          <Button className="h-10 flex-1" onClick={onSave} disabled={pending || !hasPosition}>
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
