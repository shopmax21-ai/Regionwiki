"use client";

import { useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { ArrowLeftRight, Cpu, Flame, Link2, Pencil, Plus, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import {
  type FuelType,
  formatPrice,
  fuelTypes,
  vehicles as seedVehicles,
  type Vehicle,
  type VehicleCategory,
  vehicleCategories,
} from "../_data/vehicles";
import { TagInput } from "./tag-input";
import { VehicleCardView } from "./vehicle-card";
import { Chip, Field, fieldId, Section } from "./vehicle-field";
import {
  buildPayload,
  decimalOnly,
  digitsOnly,
  emptyForm,
  type FieldErrors,
  type FormState,
  groupDigits,
  LIMITS,
  previewVehicle,
  toForm,
} from "./vehicle-form";
import { categoryIcons } from "./vehicle-image";
import { VehicleImageDrop } from "./vehicle-image-drop";
import { VehicleUpgradesEditor } from "./vehicle-upgrades-editor";

/** Самые частые источники из каталога: подсказки под полем «Источники» */
const popularSources = (() => {
  const counts = new Map<string, number>();
  for (const vehicle of seedVehicles)
    for (const source of vehicle.sources) counts.set(source, (counts.get(source) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source]) => source);
})();

const features = [
  { key: "transferable", label: "Можно передавать", icon: ArrowLeftRight },
  { key: "driftChip", label: "Дрифт-чип", icon: Cpu },
  { key: "nitro", label: "Нитро", icon: Flame },
  { key: "isNew", label: "Новинка", icon: Sparkles },
] as const;

/** Форма без случайных ключей строк: так можно честно сравнить «было» и «стало» */
const snapshot = (form: FormState) => JSON.stringify(form, (key, value) => (key === "key" ? undefined : value));

type VehicleEditorProps = { mode: "create" } | { mode: "edit"; vehicle: Vehicle };

/**
 * Кнопка и окно добавления или редактирования транспорта. Показывается только администраторам.
 * Слева форма по разделам, справа карточка-предпросмотр: в неё можно перетащить картинку, выбрать её по нажатию
 * или вставить через Ctrl+V.
 */
export function VehicleEditor(props: VehicleEditorProps) {
  const router = useRouter();
  const editing = props.mode === "edit";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const initialSnapshot = useRef("");

  const dirty = open && snapshot(form) !== initialSnapshot.current;
  const preview = useMemo(() => previewVehicle(form), [form]);

  const clearError = (field: string) =>
    setErrors((current) => {
      if (!(field in current)) return current;
      const { [field]: _removed, ...rest } = current;
      return rest;
    });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    clearError(key);
    setServerError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const initial = editing ? toForm(props.vehicle) : emptyForm();
      initialSnapshot.current = snapshot(initial);
      setForm(initial);
      setErrors({});
      setServerError(null);
      setShowLink(false);
      setOpen(true);
      return;
    }
    if (saving) return;
    // Закрытие с несохранёнными правками: сначала спрашиваем
    if (dirty) setConfirmClose(true);
    else setOpen(false);
  };

  const focusField = (field: string) => {
    requestAnimationFrame(() => {
      const element = document.getElementById(fieldId(field));
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      element?.focus({ preventScroll: true });
    });
  };

  const save = async () => {
    if (saving) return;
    setServerError(null);
    const built = buildPayload(form, { editing });
    if (!built.ok) {
      setErrors(built.errors);
      if (built.first === "imageUrl") setShowLink(true);
      focusField(built.first);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/vehicles/${props.vehicle.code}` : "/api/vehicles", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        if (response.status === 409) {
          setErrors({ code: "Такой код уже занят, измените его" });
          focusField("code");
        } else {
          setServerError(data.error ?? "Не удалось сохранить");
        }
        return;
      }
      toast.success(editing ? "Изменения сохранены" : "Транспорт добавлен");
      initialSnapshot.current = snapshot(form);
      setOpen(false);
      router.refresh();
    } catch {
      setServerError("Нет связи с сервером, попробуйте ещё раз");
    } finally {
      setSaving(false);
    }
  };

  const speed = Number(form.speed);
  const tuned = Number(form.tunedSpeed);
  const tunedBelowBase = form.speed !== "" && form.tunedSpeed !== "" && tuned < speed;
  const price = Number(form.price);
  const halfPrice = Number.isFinite(price) && price > 0 ? groupDigits(String(Math.round(price / 2))) : "";
  let saveLabel = editing ? "Сохранить" : "Добавить транспорт";
  if (saving) saveLabel = "Сохраняем...";
  const showLoad = form.category === "Грузовые" || form.loadTons !== "";

  return (
    <>
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

        <DialogContent
          className="max-h-[92vh] gap-5 overflow-y-auto sm:max-w-5xl"
          onKeyDown={(event) => {
            // Ctrl+Enter (или Cmd+Enter) сохраняет из любого поля
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editing ? `Редактирование: ${props.vehicle.name} ${props.vehicle.model}` : "Добавление транспорта"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:order-2 lg:self-start">
              <p className="font-medium text-muted-foreground text-xs">Предпросмотр карточки</p>
              <VehicleCardView
                vehicle={preview}
                image={
                  <VehicleImageDrop
                    value={form.imageUrl}
                    onChange={(url) => set("imageUrl", url)}
                    category={form.category}
                    alt={`${preview.name} ${preview.model}`}
                    active={open}
                    disabled={saving}
                  />
                }
              />
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowLink((value) => !value)}
                  className="flex w-fit items-center gap-1.5 text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:underline"
                  aria-expanded={showLink}
                >
                  <Link2 className="size-3.5" aria-hidden="true" /> Указать ссылку на картинку
                </button>
                {showLink && (
                  <Field
                    id="imageUrl"
                    label="Ссылка или путь"
                    hint="Ссылка https://... или путь вида /images/transport/name.png"
                    error={errors.imageUrl}
                  >
                    <Input
                      id={fieldId("imageUrl")}
                      value={form.imageUrl}
                      aria-invalid={Boolean(errors.imageUrl)}
                      onChange={(event) => set("imageUrl", event.target.value)}
                      placeholder="https://..."
                    />
                  </Field>
                )}
              </div>
            </aside>

            <div className="flex min-w-0 flex-col gap-6 lg:order-1">
              <Section title="Основное">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="name" label="Название" error={errors.name}>
                    <Input
                      id={fieldId("name")}
                      value={form.name}
                      maxLength={LIMITS.name}
                      aria-invalid={Boolean(errors.name)}
                      placeholder="Superior"
                      onChange={(event) => set("name", event.target.value)}
                    />
                  </Field>
                  <Field id="model" label="Модель" error={errors.model}>
                    <Input
                      id={fieldId("model")}
                      value={form.model}
                      maxLength={LIMITS.model}
                      aria-invalid={Boolean(errors.model)}
                      placeholder="90G"
                      onChange={(event) => set("model", event.target.value)}
                    />
                  </Field>
                </div>

                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1.5 font-medium text-sm">Категория</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {vehicleCategories.map((category: VehicleCategory) => {
                      const Icon = categoryIcons[category];
                      return (
                        <Chip
                          key={category}
                          pressed={form.category === category}
                          onClick={() => set("category", category)}
                        >
                          <Icon aria-hidden="true" /> {category}
                        </Chip>
                      );
                    })}
                  </div>
                </fieldset>

                <Field
                  id="code"
                  label="Код (адрес страницы)"
                  error={errors.code}
                  hint={
                    editing ? (
                      "Код нельзя изменить"
                    ) : (
                      <>
                        Впишите вручную: латиница, цифры и дефис. Адрес:{" "}
                        <span className="text-foreground">/dashboard/transport/{form.code || "…"}</span>
                      </>
                    )
                  }
                >
                  <Input
                    id={fieldId("code")}
                    value={form.code}
                    disabled={editing}
                    maxLength={49}
                    aria-invalid={Boolean(errors.code)}
                    placeholder="superior-90g"
                    onChange={(event) => {
                      const value = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                      clearError("code");
                      setForm((prev) => ({ ...prev, code: value }));
                    }}
                  />
                </Field>
              </Section>

              <Section title="Характеристики">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="speed" label="Скорость, км/ч" error={errors.speed}>
                    <Input
                      id={fieldId("speed")}
                      inputMode="numeric"
                      value={form.speed}
                      aria-invalid={Boolean(errors.speed)}
                      onChange={(event) => set("speed", digitsOnly(event.target.value, 4))}
                    />
                  </Field>
                  <Field id="tunedSpeed" label="Скорость в тюнинге, км/ч" error={errors.tunedSpeed}>
                    <Input
                      id={fieldId("tunedSpeed")}
                      inputMode="numeric"
                      value={form.tunedSpeed}
                      aria-invalid={Boolean(errors.tunedSpeed)}
                      onChange={(event) => set("tunedSpeed", digitsOnly(event.target.value, 4))}
                    />
                  </Field>
                </div>
                {tunedBelowBase && (
                  <p className="flex items-center gap-1.5 text-amber-600 text-xs dark:text-amber-400">
                    <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                    Скорость в тюнинге меньше обычной. Проверьте, не перепутаны ли поля.
                  </p>
                )}

                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1.5 font-medium text-sm">Топливо</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {fuelTypes.map((fuel: FuelType) => (
                      <Chip key={fuel} pressed={form.fuel === fuel} onClick={() => set("fuel", fuel)}>
                        {fuel}
                      </Chip>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="trunkKg" label="Багажник, кг" error={errors.trunkKg}>
                    <Input
                      id={fieldId("trunkKg")}
                      inputMode="numeric"
                      value={form.trunkKg}
                      aria-invalid={Boolean(errors.trunkKg)}
                      onChange={(event) => set("trunkKg", digitsOnly(event.target.value, 6))}
                    />
                  </Field>
                  {showLoad && (
                    <Field id="loadTons" label="Грузоподъёмность, т" hint="Только для грузовых" error={errors.loadTons}>
                      <Input
                        id={fieldId("loadTons")}
                        inputMode="decimal"
                        value={form.loadTons}
                        aria-invalid={Boolean(errors.loadTons)}
                        onChange={(event) => set("loadTons", decimalOnly(event.target.value))}
                      />
                    </Field>
                  )}
                </div>

                <fieldset className="flex flex-wrap gap-1.5">
                  <legend className="sr-only">Особенности</legend>
                  {features.map(({ key, label, icon: Icon }) => (
                    <Chip key={key} pressed={form[key]} onClick={() => set(key, !form[key])}>
                      <Icon aria-hidden="true" /> {label}
                    </Chip>
                  ))}
                </fieldset>
              </Section>

              <Section title="Стоимость и получение">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="price" label="Гос. стоимость" error={errors.price}>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <Input
                        id={fieldId("price")}
                        inputMode="numeric"
                        className="pl-6 tabular-nums"
                        value={groupDigits(form.price)}
                        aria-invalid={Boolean(errors.price)}
                        onChange={(event) => set("price", digitsOnly(event.target.value, 11))}
                      />
                    </div>
                  </Field>
                  <Field
                    id="scrapPrice"
                    label="Стоимость свалки"
                    hint="Если пусто, считается как половина гос. стоимости"
                    error={errors.scrapPrice}
                  >
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <Input
                        id={fieldId("scrapPrice")}
                        inputMode="numeric"
                        className="pl-6 tabular-nums"
                        value={groupDigits(form.scrapPrice)}
                        placeholder={halfPrice}
                        aria-invalid={Boolean(errors.scrapPrice)}
                        onChange={(event) => set("scrapPrice", digitsOnly(event.target.value, 11))}
                      />
                    </div>
                  </Field>
                </div>
                {form.price !== "" && Number.isFinite(price) && price > 0 && (
                  <p className="text-muted-foreground text-xs">
                    В карточке: <span className="font-medium text-foreground">{formatPrice(price)}</span>
                  </p>
                )}

                <Field
                  id="sources"
                  label="Источники получения"
                  hint="Enter или запятая добавляют источник. Можно вставить список целиком."
                  error={errors.sources}
                >
                  <TagInput
                    id={fieldId("sources")}
                    values={form.sources}
                    onChange={(values) => set("sources", values)}
                    suggestions={popularSources}
                    placeholder="Кейс, салон, магазин..."
                    maxItems={LIMITS.sources}
                    maxLength={LIMITS.source}
                    invalid={Boolean(errors.sources)}
                  />
                </Field>
              </Section>

              <Section
                title="Улучшения"
                description="У каждого улучшения свои уровни: цена установки и прирост, который он даёт."
              >
                <VehicleUpgradesEditor
                  upgrades={form.upgrades}
                  onChange={(upgrades) => set("upgrades", upgrades)}
                  errors={errors}
                  clearError={clearError}
                />
              </Section>
            </div>
          </div>

          {serverError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm"
            >
              {serverError}
            </p>
          )}

          <DialogFooter className="sticky bottom-0 z-10 items-center sm:justify-between">
            <span className="hidden text-muted-foreground text-xs sm:inline">
              <kbd className="rounded border bg-background px-1 font-sans">Ctrl</kbd>+
              <kbd className="rounded border bg-background px-1 font-sans">Enter</kbd> — сохранить
            </span>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
                Отмена
              </Button>
              <Button onClick={save} disabled={saving}>
                {saveLabel}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent className="data-[size=default]:sm:max-w-md">
          <AlertDialogHeader className="sm:group-data-[size=default]/alert-dialog-content:place-items-start">
            <AlertDialogTitle>Закрыть без сохранения?</AlertDialogTitle>
            <AlertDialogDescription>В форме есть несохранённые изменения, они пропадут.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col sm:justify-stretch">
            <AlertDialogCancel className="w-full">Продолжить редактирование</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="w-full"
              onClick={() => {
                setConfirmClose(false);
                setOpen(false);
              }}
            >
              Закрыть без сохранения
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
