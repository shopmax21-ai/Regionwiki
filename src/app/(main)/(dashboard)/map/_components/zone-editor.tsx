"use client";

import { useEffect, useId, useState, useTransition } from "react";

import { cn } from "cn";
import { Eraser, MousePointerClick, Pencil, Trash2, Undo2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { deleteZoneAction } from "../_actions";
import { getZoneColor, type MapZone, ZONE_LIMITS, type ZoneDraft, zoneColors } from "./zone-data";

const cardClass =
  "absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 max-h-[70%] overflow-y-auto shadow-lg md:static md:max-h-none md:min-h-0 md:w-full md:shrink";

interface ZoneEditorProps {
  draft: ZoneDraft;
  onChange: (patch: Partial<ZoneDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}

/**
 * Форма рисования зоны. Лежит внутри раздела карты, а не в диалоге-портале,
 * поэтому остаётся видимой и рабочей в полноэкранном режиме.
 */
export function ZoneEditor({ draft, onChange, onSave, onCancel, pending, error }: ZoneEditorProps) {
  const fieldId = useId();
  const creating = draft.id === null;
  const count = draft.points.length;
  const ready = count >= ZONE_LIMITS.minPoints;

  return (
    <Card size="sm" className={cardClass}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium text-base leading-tight">{creating ? "Новая зона" : "Изменение зоны"}</h2>
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
            "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
            ready ? "bg-muted text-muted-foreground" : "bg-primary/10 text-foreground",
          )}
        >
          <MousePointerClick aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {ready
              ? "Кликайте по карте, чтобы добавить точки. Точку можно перетащить, двойной клик удаляет её."
              : `Кликайте по карте, чтобы обвести зону: нужно минимум ${ZONE_LIMITS.minPoints} точки.`}
            <span className="mt-1 block tabular-nums">Точек: {count}</span>
          </span>
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-9 flex-1"
            disabled={pending || count === 0}
            onClick={() => onChange({ points: draft.points.slice(0, -1) })}
          >
            <Undo2 data-icon="inline-start" /> Убрать точку
          </Button>
          <Button
            variant="outline"
            className="h-9 flex-1"
            disabled={pending || count === 0}
            onClick={() => onChange({ points: [] })}
          >
            <Eraser data-icon="inline-start" /> Очистить
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-name`}>Название</Label>
          <Input
            id={`${fieldId}-name`}
            value={draft.name}
            maxLength={ZONE_LIMITS.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Например, Зелёная зона у больницы"
            autoComplete="off"
          />
        </div>

        <fieldset className="flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 font-medium text-sm">Цвет</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {zoneColors.map((color) => {
              const active = draft.color === color.id;
              return (
                <Button
                  key={color.id}
                  type="button"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  className="h-10 justify-start gap-2 px-2.5 text-sm"
                  onClick={() => onChange({ color: color.id })}
                >
                  <span aria-hidden="true" className={cn("size-3.5 shrink-0 rounded-full", color.dotClass)} />
                  <span className="truncate">{color.label}</span>
                </Button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-description`}>Описание</Label>
          <Textarea
            id={`${fieldId}-description`}
            value={draft.description}
            maxLength={ZONE_LIMITS.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Необязательно: что это за зона, какие в ней правила"
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
          <Button className="h-10 flex-1" onClick={onSave} disabled={pending || !ready || draft.name.trim() === ""}>
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ZoneCardProps {
  zone: MapZone;
  onClose: () => void;
  canEdit: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}

/** Карточка выбранной зоны. Обратная связь показывается прямо в ней: toast и диалоги в порталах в полноэкранном режиме не видны. */
export function ZoneCard({ zone, onClose, canEdit, onEdit, onDeleted }: ZoneCardProps) {
  const color = getZoneColor(zone.color);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Выбрали другую зону: подтверждение удаления старой не должно «прилипнуть»
  // biome-ignore lint/correctness/useExhaustiveDependencies: сбрасываем при смене зоны
  useEffect(() => {
    setConfirming(false);
    setError(null);
  }, [zone.id]);

  const remove = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteZoneAction(zone.id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDeleted();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <Card size="sm" className={cardClass}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className={cn("mt-1 size-4 shrink-0 rounded-full", color.dotClass)} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="font-medium text-base leading-tight">{zone.name}</h2>
            <p className="text-muted-foreground text-xs">{color.label} зона</p>
          </div>
          <Button variant="ghost" className="-mt-1 -mr-1 size-10" aria-label="Закрыть" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        {zone.description && <p className="whitespace-pre-line text-muted-foreground text-sm">{zone.description}</p>}

        {canEdit && !confirming && (
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 flex-1" onClick={onEdit}>
              <Pencil data-icon="inline-start" /> Изменить
            </Button>
            <Button
              variant="outline"
              className="h-10 flex-1 text-destructive hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 data-icon="inline-start" /> Удалить
            </Button>
          </div>
        )}

        {canEdit && confirming && (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm">Удалить зону «{zone.name}»? Она исчезнет у всех, отменить это нельзя.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1" disabled={pending} onClick={() => setConfirming(false)}>
                Отмена
              </Button>
              <Button variant="destructive" className="h-10 flex-1" disabled={pending} onClick={remove}>
                {pending ? "Удаление..." : "Удалить"}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
