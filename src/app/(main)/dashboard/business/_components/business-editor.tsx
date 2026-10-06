"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { MapPin, Pencil, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { EstateImageDrop } from "@/app/(main)/dashboard/_components/estate-image-drop";
import { ConfirmCloseDialog } from "@/app/(main)/dashboard/_components/record-dialogs";
import { isInsideWorld } from "@/app/(main)/dashboard/map/_components/map-data";
import { Chip, Field, fieldId, Section } from "@/app/(main)/dashboard/transport/_components/vehicle-field";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import {
  type Business,
  type BusinessCategory,
  businessCode,
  businessMapHref,
  businessTitle,
  categories,
  formatPrice,
} from "../_data/businesses";
import { BusinessCard } from "./business-card";
import { categoryIcons } from "./business-image";

/** Метка общей карты: из неё берутся готовые координаты. */
export type MapPlaceOption = { id: string; name: string; x: number; y: number };

const businessCategories = categories.filter((item): item is BusinessCategory => item !== "Все");

type FormState = { category: BusinessCategory; id: string; price: string; imageUrl: string; x: string; y: string };

const emptyForm = (): FormState => ({
  category: businessCategories[0],
  id: "",
  price: "",
  imageUrl: "",
  x: "",
  y: "",
});

const toForm = (business: Business): FormState => ({
  category: business.category,
  id: String(business.id),
  price: String(business.price),
  imageUrl: business.imageUrl ?? "",
  x: business.location ? String(business.location.x) : "",
  y: business.location ? String(business.location.y) : "",
});

const digitsOnly = (value: string, max: number) => value.replace(/\D/g, "").slice(0, max);

const parseCoordinate = (value: string): number | null => {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

type Errors = Partial<Record<keyof FormState, string>>;

function build(form: FormState): { ok: true; business: Business } | { ok: false; errors: Errors; first: string } {
  const errors: Errors = {};

  const id = Number(form.id);
  if (!form.id || !Number.isInteger(id) || id < 1) errors.id = "Введите номер бизнеса, например 5";

  const price = Number(form.price);
  if (form.price === "" || !Number.isInteger(price) || price < 0) errors.price = "Введите стоимость числом";

  let location: Business["location"];
  const hasX = form.x.trim() !== "";
  const hasY = form.y.trim() !== "";
  if (hasX || hasY) {
    const x = parseCoordinate(form.x);
    const y = parseCoordinate(form.y);
    if (x === null || y === null) {
      errors.x = "Заполните обе координаты или очистите обе";
    } else if (!isInsideWorld({ x, y })) {
      errors.x = "Эти координаты за пределами карты";
    } else {
      location = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    }
  }

  const imageUrl = form.imageUrl.trim();
  if (imageUrl && !/^(\/(?!\/)|https:\/\/)\S+$/.test(imageUrl))
    errors.imageUrl = "Нужна ссылка https://... или путь /images/...";

  const first = (Object.keys(errors) as (keyof FormState)[])[0];
  if (first) return { ok: false, errors, first };

  return {
    ok: true,
    business: { category: form.category, id, price, imageUrl: imageUrl || undefined, location },
  };
}

type BusinessEditorProps =
  | { mode: "create"; mapPlaces: MapPlaceOption[] }
  | { mode: "edit"; business: Business; mapPlaces: MapPlaceOption[] };

/** Окно добавления и редактирования бизнеса. Справа карточка, какой она будет в каталоге. */
export function BusinessEditor(props: BusinessEditorProps) {
  const router = useRouter();
  const editing = props.mode === "edit";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [initial, setInitial] = useState("");

  const dirty = open && JSON.stringify(form) !== initial;

  const preview = useMemo<Business>(() => {
    const x = parseCoordinate(form.x);
    const y = parseCoordinate(form.y);
    return {
      category: form.category,
      id: Number(form.id) || 0,
      price: Number(form.price) || 0,
      imageUrl: form.imageUrl || undefined,
      location: x !== null && y !== null && isInsideWorld({ x, y }) ? { x, y } : undefined,
    };
  }, [form]);

  const clearError = (...keys: (keyof FormState)[]) =>
    setErrors((current) => {
      if (!keys.some((key) => key in current)) return current;
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    // Ошибка про координаты показывается под X, поэтому правка Y тоже её снимает
    clearError(key === "y" ? "x" : key);
    setServerError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const start = editing ? toForm(props.business) : emptyForm();
      setInitial(JSON.stringify(start));
      setForm(start);
      setErrors({});
      setServerError(null);
      setOpen(true);
      return;
    }
    if (saving) return;
    if (dirty) setConfirmClose(true);
    else setOpen(false);
  };

  const focusField = (field: string) => {
    requestAnimationFrame(() => {
      const element = document.getElementById(fieldId(field === "imageUrl" ? "id" : field));
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      element?.focus({ preventScroll: true });
    });
  };

  const save = async () => {
    if (saving) return;
    setServerError(null);
    const built = build(form);
    if (!built.ok) {
      setErrors(built.errors);
      focusField(built.first);
      return;
    }

    setSaving(true);
    try {
      const endpoint = editing ? `/api/businesses/${businessCode(props.business)}` : "/api/businesses";
      const response = await fetch(endpoint, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.business),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        if (response.status === 409) {
          setErrors({ id: "Бизнес с таким типом и номером уже есть" });
          focusField("id");
        } else {
          setServerError(data.error ?? "Не удалось сохранить");
        }
        return;
      }
      toast.success(editing ? "Изменения сохранены" : "Бизнес добавлен");
      setInitial(JSON.stringify(form));
      setOpen(false);
      router.refresh();
    } catch {
      setServerError("Нет связи с сервером, попробуйте ещё раз");
    } finally {
      setSaving(false);
    }
  };

  const pickPlace = (value: string) => {
    const place = props.mapPlaces.find((item) => item.id === value);
    if (!place) return;
    clearError("x");
    setForm((prev) => ({ ...prev, x: String(place.x), y: String(place.y) }));
  };

  const mapHref = businessMapHref(preview);
  let submitLabel = editing ? "Сохранить" : "Добавить бизнес";
  if (saving) submitLabel = "Сохраняем...";

  const title = editing ? businessTitle(props.business) : "Новый бизнес";
  const Icon = categoryIcons[form.category];

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {editing ? (
            <Button
              type="button"
              size="icon-xs"
              variant="secondary"
              aria-label={`Редактировать: ${businessTitle(props.business)}`}
              title="Редактировать"
            >
              <Pencil />
            </Button>
          ) : (
            <Button size="sm">
              <Plus data-icon="inline-start" /> Добавить бизнес
            </Button>
          )}
        </DialogTrigger>

        <DialogContent
          className="max-h-[92vh] gap-5 overflow-y-auto sm:max-w-3xl"
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{editing ? `Редактирование: ${title}` : title}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
            <aside className="flex flex-col gap-3 md:order-2 md:self-start">
              <p className="font-medium text-muted-foreground text-xs">Предпросмотр карточки</p>
              <BusinessCard
                business={preview}
                image={
                  <EstateImageDrop
                    value={form.imageUrl}
                    onChange={(url) => set("imageUrl", url)}
                    icon={Icon}
                    alt={businessTitle(preview)}
                    active={open}
                    disabled={saving}
                  />
                }
              />
              {errors.imageUrl && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.imageUrl}
                </p>
              )}
            </aside>

            <div className="flex flex-col gap-5">
              <Section title="Основное">
                <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
                  <legend className="mb-1.5 font-medium text-sm">Тип бизнеса</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {businessCategories.map((category) => {
                      const CategoryIcon = categoryIcons[category];
                      return (
                        <Chip
                          key={category}
                          pressed={form.category === category}
                          disabled={editing}
                          onClick={() => set("category", category)}
                        >
                          <CategoryIcon aria-hidden="true" /> {category}
                        </Chip>
                      );
                    })}
                  </div>
                  {editing && <p className="text-muted-foreground text-xs">Тип и номер нельзя изменить</p>}
                </fieldset>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id="id"
                    label="Номер (ID)"
                    error={errors.id}
                    hint="Номер внутри типа: Банкомат #90 и Заправка #90 разные"
                  >
                    <Input
                      id={fieldId("id")}
                      inputMode="numeric"
                      value={form.id}
                      disabled={editing}
                      aria-invalid={Boolean(errors.id)}
                      placeholder="5"
                      onChange={(event) => set("id", digitsOnly(event.target.value, 6))}
                    />
                  </Field>
                  <Field
                    id="price"
                    label="Гос. стоимость, $"
                    error={errors.price}
                    hint={preview.price > 0 ? formatPrice(preview.price) : undefined}
                  >
                    <Input
                      id={fieldId("price")}
                      inputMode="numeric"
                      value={form.price}
                      aria-invalid={Boolean(errors.price)}
                      placeholder="750000"
                      onChange={(event) => set("price", digitsOnly(event.target.value, 11))}
                    />
                  </Field>
                </div>
              </Section>

              <Section
                title="Место на карте"
                description="Необязательно. Если указать координаты, в карточке появится ссылка «На карте»."
              >
                {props.mapPlaces.length > 0 && (
                  <Field id="place" label="Взять из меток карты">
                    <NativeSelect
                      id={fieldId("place")}
                      className="w-full"
                      value=""
                      onChange={(event) => pickPlace(event.target.value)}
                    >
                      <NativeSelectOption value="">Выберите метку…</NativeSelectOption>
                      {props.mapPlaces.map((place) => (
                        <NativeSelectOption key={place.id} value={place.id}>
                          {place.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="x" label="Координата X" error={errors.x}>
                    <Input
                      id={fieldId("x")}
                      inputMode="decimal"
                      value={form.x}
                      aria-invalid={Boolean(errors.x)}
                      placeholder="734.64"
                      onChange={(event) => set("x", event.target.value.replace(/[^\d.,-]/g, ""))}
                    />
                  </Field>
                  <Field id="y" label="Координата Y">
                    <Input
                      id={fieldId("y")}
                      inputMode="decimal"
                      value={form.y}
                      placeholder="128.55"
                      onChange={(event) => set("y", event.target.value.replace(/[^\d.,-]/g, ""))}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {mapHref ? (
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground underline underline-offset-2 hover:text-primary"
                    >
                      Проверить место на карте
                    </a>
                  ) : (
                    <span>Координаты можно скопировать из формы метки на карте</span>
                  )}
                  {(form.x || form.y) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="ml-auto"
                      onClick={() => {
                        clearError("x");
                        setForm((prev) => ({ ...prev, x: "", y: "" }));
                      }}
                    >
                      Убрать место
                    </Button>
                  )}
                </div>
              </Section>
            </div>
          </div>

          {serverError && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm"
            >
              <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> {serverError}
            </p>
          )}

          <DialogFooter className="items-center sm:justify-between">
            <span className="hidden text-muted-foreground text-xs sm:inline">
              <kbd className="rounded border bg-background px-1 font-sans">Ctrl</kbd>+
              <kbd className="rounded border bg-background px-1 font-sans">Enter</kbd> — сохранить
            </span>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
                Отмена
              </Button>
              <Button onClick={save} disabled={saving}>
                {submitLabel}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmCloseDialog open={confirmClose} onOpenChange={setConfirmClose} onConfirm={() => setOpen(false)} />
    </>
  );
}
