"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { createItemAction, updateItemAction } from "../_actions";
import {
  defaultItemFlags,
  type Item,
  type ItemCategory,
  type ItemFlagKey,
  type ItemFlags,
  itemCategories,
  itemFlagDefs,
} from "../_data/items";
import { ItemImageField } from "./item-image-field";

type FormState = {
  id: string;
  name: string;
  category: ItemCategory;
  imageUrl: string;
  description: string;
  weight: string;
  obtain: string;
  flags: ItemFlags;
};

type ItemEditorProps = {
  /** Предмет для редактирования. Не указан — создаётся новый. */
  item?: Item;
  /** Категория, которая выбрана при создании (например, открытая в фильтре) */
  defaultCategory?: ItemCategory;
  onClose: () => void;
};

/** Окно добавления и редактирования предмета. Монтируйте его только когда нужно показать, форма берёт данные при открытии. */
export function ItemEditor({ item, defaultCategory, onClose }: ItemEditorProps) {
  const router = useRouter();
  const editing = item !== undefined;
  const [form, setForm] = useState<FormState>({
    id: item ? String(item.id) : "",
    name: item?.name ?? "",
    category: item?.category ?? defaultCategory ?? itemCategories[0],
    imageUrl: item?.imageUrl ?? "",
    description: item?.description ?? "",
    weight: item?.weight === undefined ? "" : String(item.weight),
    obtain: item?.obtain ?? "",
    flags: item?.flags ?? defaultItemFlags,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setFlag = (key: ItemFlagKey, value: boolean) =>
    setForm((prev) => ({ ...prev, flags: { ...prev.flags, [key]: value } }));

  const save = () => {
    setError(null);

    const rawId = form.id.trim();
    const id = rawId === "" ? undefined : Number(rawId);
    if (!editing && id !== undefined && (!Number.isInteger(id) || id < 1)) {
      setError("ID должен быть целым числом больше нуля или пустым");
      return;
    }
    if (form.name.trim() === "") {
      setError("Укажите название предмета");
      return;
    }

    const rawWeight = form.weight.trim().replace(",", ".");
    const weight = rawWeight === "" ? undefined : Number(rawWeight);
    if (weight !== undefined && (!Number.isFinite(weight) || weight < 0)) {
      setError("Вес должен быть числом не меньше нуля или пустым");
      return;
    }

    const payload = {
      id,
      name: form.name,
      category: form.category,
      imageUrl: form.imageUrl.trim() || undefined,
      description: form.description.trim() || undefined,
      weight,
      obtain: form.obtain.trim() || undefined,
      flags: form.flags,
    };

    startSaving(async () => {
      try {
        const result = item ? await updateItemAction(item.id, payload) : await createItemAction(payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(editing ? "Изменения сохранены" : "Предмет добавлен");
        onClose();
        router.refresh();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? `Редактирование: ${item.name}` : "Добавление предмета"}</DialogTitle>
          <DialogDescription>Изменения сразу появятся на сайте для всех посетителей.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="item-name">Название</Label>
            <Input
              id="item-name"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Например, Аптечка"
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-category">Категория</Label>
            <NativeSelect
              id="item-category"
              className="w-full"
              value={form.category}
              onChange={(event) => set("category", event.target.value as ItemCategory)}
            >
              {itemCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-id">ID</Label>
            <Input
              id="item-id"
              inputMode="numeric"
              value={form.id}
              onChange={(event) => set("id", event.target.value)}
              disabled={editing}
              placeholder="Следующий свободный"
            />
            <p className="text-muted-foreground text-xs">
              {editing ? "ID нельзя изменить" : "Можно оставить пустым, номер выдастся сам"}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="item-description">Описание</Label>
            <Input
              id="item-description"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder="Используется для защиты персонажа"
              maxLength={300}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-weight">Вес, кг</Label>
            <Input
              id="item-weight"
              inputMode="decimal"
              value={form.weight}
              onChange={(event) => set("weight", event.target.value)}
              placeholder="1"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-obtain">Где можно получить</Label>
            <Textarea
              id="item-obtain"
              rows={2}
              value={form.obtain}
              onChange={(event) => set("obtain", event.target.value)}
              placeholder={`Если пусто: «Получить предмет можно в разделе «${form.category}»»`}
              maxLength={300}
            />
          </div>

          <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0 sm:col-span-2 sm:grid-cols-2">
            <legend className="mb-1.5 font-medium text-sm">Свойства</legend>
            {itemFlagDefs.map((def) => (
              <Label
                key={def.key}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 font-normal"
              >
                {def.label}
                <Switch
                  checked={form.flags[def.key]}
                  onCheckedChange={(value) => setFlag(def.key, value)}
                  aria-label={def.label}
                />
              </Label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Картинка</Label>
            <ItemImageField value={form.imageUrl} onChange={(url) => set("imageUrl", url)} active disabled={saving} />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          >
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Сохраняем..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
