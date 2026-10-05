"use client";

import { useEffect, useState, useTransition } from "react";

import { Check, Copy, Pencil, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { deletePlaceAction } from "../_actions";
import { getCategory, type MapPlace } from "./map-data";
import { MarkerBadge } from "./place-icons";

interface PlaceCardProps {
  place: MapPlace;
  onClose: () => void;
  /** Показывает кнопки «Изменить» и «Удалить». Только для тех, у кого есть право редактирования карты. */
  canEdit?: boolean;
  onEdit?: () => void;
  onDeleted?: () => void;
}

type CopyState = "idle" | "done" | "failed";

/**
 * Карточка выбранной метки. Никаких toast и диалогов в порталах: они не видны в полноэкранном режиме,
 * поэтому обратная связь показывается прямо в карточке.
 */
export function PlaceCard({ place, onClose, canEdit = false, onEdit, onDeleted }: PlaceCardProps) {
  const category = getCategory(place.category);
  const coordinates = `${Math.round(place.x)}, ${Math.round(place.y)}`;

  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const copyCoordinates = async () => {
    try {
      await navigator.clipboard.writeText(coordinates);
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
  };

  const remove = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await deletePlaceAction(place.id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDeleted?.();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <Card
      size="sm"
      className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 max-h-[70%] overflow-y-auto shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:w-80"
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <MarkerBadge category={place.category} icon={place.icon} size="xl" className="rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="font-medium text-base leading-tight">{place.name}</h2>
            <Badge variant="secondary">{category.label}</Badge>
          </div>
          <Button variant="ghost" className="-mt-1 -mr-1 size-10" aria-label="Закрыть" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        {place.description && (
          <p className="whitespace-pre-line text-muted-foreground text-sm">{place.description}</p>
        )}

        <Button variant="outline" className="h-11 justify-between px-3 text-sm" onClick={copyCoordinates}>
          <span className="text-muted-foreground">Координаты</span>
          <span className="flex items-center gap-2 tabular-nums" aria-live="polite">
            {copyState === "done" ? "Скопировано" : copyState === "failed" ? "Не удалось скопировать" : coordinates}
            {copyState === "done" ? <Check className="size-4" /> : <Copy className="size-4" />}
          </span>
        </Button>

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
            <p className="text-sm">Удалить метку «{place.name}»? Она исчезнет у всех, отменить это нельзя.</p>
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
