"use client";

import { useState } from "react";

import { cn } from "cn";
import { Check, Copy, Pencil, Tag, Trash2, Weight, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import { type Item, itemFlagDefs } from "../_data/items";
import { ItemId, ItemImage } from "./item-card";

type ItemDetailsDialogProps = {
  item: Item | null;
  /** Показывать кнопки «Редактировать» и «Удалить» */
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
};

function FlagRow({ label, value }: { label: string; value: boolean }) {
  const Icon = value ? Check : X;

  return (
    <div className="grid grid-cols-2 border-b last:border-b-0">
      <dt className="border-r px-4 py-3 text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 px-4 py-3 font-medium">
        <Icon className={value ? "size-5 text-green-500" : "size-5 text-red-500"} aria-hidden="true" />
        {value ? "Да" : "Нет"}
      </dd>
    </div>
  );
}

function Tile({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-xl bg-muted/50 px-4 py-3", className)}>{children}</div>
  );
}

function CopyId({ id }: { id: number }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(id));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать ID");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="-mr-1.5 shrink-0"
      onClick={copy}
      aria-label="Скопировать ID"
    >
      {copied ? <Check className="text-green-500" /> : <Copy />}
    </Button>
  );
}

/** Окно предмета: слева картинка, описание и где получить, справа свойства, категория, вес и ID. */
export function ItemDetailsDialog({ item, canEdit, onOpenChange, onEdit, onDelete }: ItemDetailsDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-4 overflow-y-auto p-4 sm:max-w-4xl sm:p-5">
        {item && (
          <>
            <div className="grid gap-4 md:grid-cols-[3fr_4fr]">
              <div className="flex min-w-0 flex-col gap-4">
                <ItemImage
                  item={item}
                  sizes="(max-width: 768px) 90vw, 400px"
                  className="rounded-xl"
                  imageClassName="p-8"
                />

                <div className="flex flex-col items-center gap-1.5 text-center">
                  <DialogTitle className="text-xl">{item.name}</DialogTitle>
                  <DialogDescription>{item.description || "Описание пока не добавлено"}</DialogDescription>
                </div>

                <section className="rounded-xl border px-4 py-3" aria-label="Где можно получить">
                  <h3 className="font-semibold">Где можно получить</h3>
                  <p className="mt-1 text-muted-foreground">
                    {item.obtain || `Получить предмет можно в разделе «${item.category}».`}
                  </p>
                </section>
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <section className="overflow-hidden rounded-xl border" aria-labelledby="item-props-title">
                  <h3
                    id="item-props-title"
                    className="border-b px-4 py-3 font-semibold text-sm uppercase tracking-wide"
                  >
                    Свойства
                  </h3>
                  <dl>
                    {itemFlagDefs.map((def) => (
                      <FlagRow key={def.key} label={def.label} value={item.flags[def.key]} />
                    ))}
                  </dl>
                </section>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Tile>
                    <Tag className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate font-medium">{item.category}</span>
                  </Tile>
                  <Tile>
                    <Weight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate font-medium">
                      {item.weight === undefined ? "—" : `${item.weight.toLocaleString("ru-RU")} кг`}
                    </span>
                  </Tile>
                  <Tile className="justify-between">
                    <ItemId id={item.id} className="font-medium" />
                    <CopyId id={item.id} />
                  </Tile>
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(item)}
                >
                  <Trash2 data-icon="inline-start" /> Удалить
                </Button>
                <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
                  <Pencil data-icon="inline-start" /> Редактировать
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
