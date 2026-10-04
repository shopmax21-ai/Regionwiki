"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { type FuelType, fuelTypes, type Vehicle, type VehicleCategory, vehicleCategories } from "../_data/vehicles";

type UpgradeForm = { name: string; description: string; levels: string };

type FormState = {
  code: string;
  name: string;
  model: string;
  category: VehicleCategory;
  speed: string;
  tunedSpeed: string;
  price: string;
  scrapPrice: string;
  fuel: FuelType;
  trunkKg: string;
  loadTons: string;
  sources: string;
  imageUrl: string;
  transferable: boolean;
  driftChip: boolean;
  nitro: boolean;
  isNew: boolean;
  upgrades: UpgradeForm[];
};

const emptyForm: FormState = {
  code: "",
  name: "",
  model: "",
  category: "Легковые",
  speed: "",
  tunedSpeed: "",
  price: "",
  scrapPrice: "",
  fuel: "АИ-95",
  trunkKg: "0",
  loadTons: "",
  sources: "",
  imageUrl: "",
  transferable: true,
  driftChip: false,
  nitro: false,
  isNew: true,
  upgrades: [],
};

const toForm = (vehicle: Vehicle): FormState => ({
  code: vehicle.code,
  name: vehicle.name,
  model: vehicle.model,
  category: vehicle.category,
  speed: String(vehicle.speed),
  tunedSpeed: String(vehicle.tunedSpeed),
  price: String(vehicle.price),
  scrapPrice: vehicle.scrapPrice === undefined ? "" : String(vehicle.scrapPrice),
  fuel: vehicle.fuel,
  trunkKg: String(vehicle.trunkKg),
  loadTons: vehicle.loadTons === undefined ? "" : String(vehicle.loadTons),
  sources: vehicle.sources.join("\n"),
  imageUrl: vehicle.imageUrl ?? "",
  transferable: vehicle.transferable,
  driftChip: vehicle.driftChip,
  nitro: vehicle.nitro,
  isNew: vehicle.isNew ?? false,
  upgrades: (vehicle.upgrades ?? []).map((upgrade) => ({
    name: upgrade.name,
    description: upgrade.description,
    levels: upgrade.levels
      .map((level) => (level.bonus ? `${level.price} | ${level.bonus}` : String(level.price)))
      .join("\n"),
  })),
});

/** Строки вида «382800» или «957000 | +20 км/ч» → уровни улучшения. */
function parseLevels(text: string, upgradeName: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error(`Улучшение «${upgradeName}»: укажите хотя бы один уровень`);

  return lines.map((line) => {
    const match = /^([\d\s_]+?)\s*(?:\|\s*(.*))?$/.exec(line);
    const price = match ? Number(match[1].replace(/[\s_]/g, "")) : Number.NaN;
    if (!Number.isFinite(price)) {
      throw new Error(`Улучшение «${upgradeName}»: уровень «${line}» нужно записать как «цена» или «цена | бонус»`);
    }
    const bonus = match?.[2]?.trim();
    return bonus ? { price, bonus } : { price };
  });
}

function requiredNumber(value: string, label: string): number {
  const number = Number(value.replace(/[\s_]/g, "").replace(",", "."));
  if (value.trim() === "" || !Number.isFinite(number)) throw new Error(`Поле «${label}» нужно заполнить числом`);
  return number;
}

function optionalNumber(value: string, label: string): number | undefined {
  return value.trim() === "" ? undefined : requiredNumber(value, label);
}

function toPayload(form: FormState) {
  const upgrades = form.upgrades.map((upgrade) => ({
    name: upgrade.name,
    description: upgrade.description,
    levels: parseLevels(upgrade.levels, upgrade.name || "без названия"),
  }));

  return {
    code: form.code,
    name: form.name,
    model: form.model,
    category: form.category,
    speed: requiredNumber(form.speed, "Скорость"),
    tunedSpeed: requiredNumber(form.tunedSpeed, "Скорость в тюнинге"),
    price: requiredNumber(form.price, "Гос. стоимость"),
    scrapPrice: optionalNumber(form.scrapPrice, "Стоимость свалки"),
    sources: form.sources
      .split("\n")
      .map((source) => source.trim())
      .filter(Boolean),
    fuel: form.fuel,
    trunkKg: requiredNumber(form.trunkKg, "Багажник"),
    loadTons: optionalNumber(form.loadTons, "Грузоподъёмность"),
    transferable: form.transferable,
    driftChip: form.driftChip,
    nitro: form.nitro,
    isNew: form.isNew,
    imageUrl: form.imageUrl.trim() || undefined,
    upgrades: upgrades.length > 0 ? upgrades : undefined,
  };
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 font-normal">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </Label>
  );
}

type VehicleEditorProps = { mode: "create" } | { mode: "edit"; vehicle: Vehicle };

/** Кнопка и окно добавления или редактирования транспорта. Показывается только администраторам. */
export function VehicleEditor(props: VehicleEditorProps) {
  const router = useRouter();
  const editing = props.mode === "edit";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(editing ? toForm(props.vehicle) : emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setUpgrade = (index: number, patch: Partial<UpgradeForm>) =>
    set(
      "upgrades",
      form.upgrades.map((upgrade, i) => (i === index ? { ...upgrade, ...patch } : upgrade)),
    );

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setForm(editing ? toForm(props.vehicle) : emptyForm);
      setError(null);
    }
    setOpen(next);
  };

  const save = async () => {
    setError(null);
    let payload: ReturnType<typeof toPayload>;
    try {
      payload = toPayload(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Проверьте заполнение формы");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/vehicles/${props.vehicle.code}` : "/api/vehicles", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Не удалось сохранить");
        return;
      }
      toast.success(editing ? "Изменения сохранены" : "Транспорт добавлен");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Нет связи с сервером, попробуйте ещё раз");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline" size="sm">
            <Pencil data-icon="inline-start" /> Редактировать
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" /> Добавить транспорт
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Редактирование: ${props.vehicle.name} ${props.vehicle.model}` : "Новый транспорт"}
          </DialogTitle>
          <DialogDescription>Изменения сразу появятся на сайте для всех посетителей.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Код (адрес страницы)"
            hint={editing ? "Код нельзя изменить" : "Латиница, цифры и дефис, например genesisg90"}
            className="sm:col-span-2"
          >
            <Input
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              disabled={editing}
              placeholder="genesisg90"
            />
          </Field>
          <Field label="Название">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Superior" />
          </Field>
          <Field label="Модель">
            <Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="90G" />
          </Field>
          <Field label="Категория">
            <NativeSelect
              className="w-full"
              value={form.category}
              onChange={(e) => set("category", e.target.value as VehicleCategory)}
            >
              {vehicleCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Топливо">
            <NativeSelect
              className="w-full"
              value={form.fuel}
              onChange={(e) => set("fuel", e.target.value as FuelType)}
            >
              {fuelTypes.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {fuel}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Скорость, км/ч">
            <Input inputMode="numeric" value={form.speed} onChange={(e) => set("speed", e.target.value)} />
          </Field>
          <Field label="Скорость в тюнинге, км/ч">
            <Input inputMode="numeric" value={form.tunedSpeed} onChange={(e) => set("tunedSpeed", e.target.value)} />
          </Field>
          <Field label="Гос. стоимость, $">
            <Input inputMode="numeric" value={form.price} onChange={(e) => set("price", e.target.value)} />
          </Field>
          <Field label="Стоимость свалки, $" hint="Если пусто, считается как половина гос. стоимости">
            <Input inputMode="numeric" value={form.scrapPrice} onChange={(e) => set("scrapPrice", e.target.value)} />
          </Field>
          <Field label="Багажник, кг">
            <Input inputMode="numeric" value={form.trunkKg} onChange={(e) => set("trunkKg", e.target.value)} />
          </Field>
          <Field label="Грузоподъёмность, т" hint="Только для грузовых">
            <Input inputMode="decimal" value={form.loadTons} onChange={(e) => set("loadTons", e.target.value)} />
          </Field>
          <Field
            label="Источники получения"
            hint="Каждый источник с новой строки: кейс, салон, магазин"
            className="sm:col-span-2"
          >
            <Textarea
              rows={3}
              value={form.sources}
              onChange={(e) => set("sources", e.target.value)}
              placeholder="Majestic Премиум"
            />
          </Field>
          <Field
            label="Картинка"
            hint="Путь вида /images/transport/name.png или ссылка https://..."
            className="sm:col-span-2"
          >
            <Input
              value={form.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              placeholder="/images/transport/genesis-g90.png"
            />
          </Field>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <ToggleField
              label="Можно передавать"
              checked={form.transferable}
              onChange={(value) => set("transferable", value)}
            />
            <ToggleField label="Дрифт-чип" checked={form.driftChip} onChange={(value) => set("driftChip", value)} />
            <ToggleField label="Нитро" checked={form.nitro} onChange={(value) => set("nitro", value)} />
            <ToggleField label="Новинка" checked={form.isNew} onChange={(value) => set("isNew", value)} />
          </div>
        </div>

        <section className="flex flex-col gap-3" aria-label="Улучшения">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-sm">Улучшения</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set("upgrades", [...form.upgrades, { name: "", description: "", levels: "" }])}
            >
              <Plus data-icon="inline-start" /> Добавить улучшение
            </Button>
          </div>

          {form.upgrades.map((upgrade, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: у улучшений нет id, порядок задаётся списком
            <div key={index} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Название">
                  <Input
                    value={upgrade.name}
                    onChange={(e) => setUpgrade(index, { name: e.target.value })}
                    placeholder="Двигатель"
                  />
                </Field>
                <Field label="Описание">
                  <Input
                    value={upgrade.description}
                    onChange={(e) => setUpgrade(index, { description: e.target.value })}
                    placeholder="Увеличивает максимальную скорость"
                  />
                </Field>
              </div>
              <Field
                label="Уровни"
                hint="Каждый уровень с новой строки: «цена» или «цена | бонус», например 957000 | +20 км/ч"
              >
                <Textarea
                  rows={4}
                  value={upgrade.levels}
                  onChange={(e) => setUpgrade(index, { levels: e.target.value })}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit text-destructive"
                onClick={() =>
                  set(
                    "upgrades",
                    form.upgrades.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 data-icon="inline-start" /> Убрать улучшение
              </Button>
            </div>
          ))}
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          >
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
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
