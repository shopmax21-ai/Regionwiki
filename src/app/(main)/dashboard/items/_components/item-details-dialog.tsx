"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Item } from "../_data/items";
import { categoryIcons, ItemId, ItemImage } from "./item-card";

type ItemDetailsDialogProps = {
  item: Item | null;
  /** Показывать кнопки «Редактировать» и «Удалить» */
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
};

/** Окно с подробностями предмета: картинка, категория и ID. */
export function ItemDetailsDialog({ item, canEdit, onOpenChange, onEdit, onDelete }: ItemDetailsDialogProps) {
  const Icon = item ? categoryIcons[item.category] : null;

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-4 overflow-y-auto sm:max-w-md">
        {item && Icon && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="text-lg">{item.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <Icon data-icon="inline-start" /> {item.category}
                </Badge>
                <ItemId id={item.id} className="text-sm" />
              </DialogDescription>
            </DialogHeader>

            <ItemImage item={item} sizes="(max-width: 640px) 90vw, 448px" className="rounded-xl border" imageClassName="p-6" />

            {canEdit && (
              <DialogFooter>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(item)}
                >
                  <Trash2 data-icon="inline-start" /> Удалить
                </Button>
                <Button variant="outline" onClick={() => onEdit(item)}>
                  <Pencil data-icon="inline-start" /> Редактировать
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
