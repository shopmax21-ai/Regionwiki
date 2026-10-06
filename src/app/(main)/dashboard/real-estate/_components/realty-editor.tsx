"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { Pencil, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { EstateImageDrop } from "@/app/(main)/dashboard/_components/estate-image-drop";
import { ConfirmCloseDialog } from "@/app/(main)/dashboard/_components/record-dialogs";
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

import { categories, formatPrice, type Realty, type RealtyCategory, realtyTitle } from "../_data/realties";
import { RealtyCard } from "./realty-card";
import { categoryIcons } from "./realty-image";

const realtyCategories = categories.filter((item): item is RealtyCategory => item !== "Все");

type View = "exterior" | "interior";

type FormState = {
  id: string;
  category: RealtyCategory;
  price: string;
  residents: string;
  garage: string;
  exteriorUrl: string;
  interiorUrl: string;
};

const emptyForm = (): FormState => ({
  id: "",
  category: realtyCategories[0],
  price: "",
  residents: "",
  garage: "",
  exteriorUrl: "",
  interiorUrl: "",
});

const toForm = (realty: Realty): FormState => ({
  id: String(realty.id),
  category: realty.category,
  price: String(realty.price),
  residents: String(realty.residents),
  garage: String(realty.garage),
  exteriorUrl: realty.exteriorUrl ?? "",
  interiorUrl: realty.interiorUrl ?? "",
});

const digitsOnly = (value: string, max: number) => value.replace(/\D/g, "").slice(0, max);

type Errors = Partial<Record<keyof FormState, string>>;

const URL_PATTERN = /^(\/(?!\/)|https:\/\/)\S+$/;

function build(form: FormState): { ok: true; realty: Realty } | { ok: false; errors: Errors; first: string } {
  const errors: Errors = {};

  const id = Number(form.id);
  if (!form.id || !Number.isInteger(id) || id < 1) errors.id = "Введите номер объекта, например 1557";

  const price = Number(form.price);
  if (form.price === "" || !Number.isInteger(price) || price < 0) errors.price = "Введите стоимость числом";

  const residents = form.residents === "" ? 0 : Number(form.residents);
  if (!Number.isInteger(residents) || residents < 0 || residents > 1000) errors.residents = "От 0 до 1000";

  const garage = form.garage === "" ? 0 : Number(form.garage);
  if (!Number.isInteger(garage) || garage < 0 || garage > 1000) errors.garage = "От 0 до 1000";

  const exteriorUrl = form.exteriorUrl.trim();
  const interiorUrl = form.interiorUrl.trim();
  if ((exteriorUrl && !URL_PATTERN.test(exteriorUrl)) || (interiorUrl && !URL_PATTERN.test(interiorUrl))) {
    errors.exteriorUrl = "Нужна ссылка https://... или путь /images/...";
  }

  const first = (Object.keys(errors) as (keyof FormState)[])[0];
  if (first) return { ok: false, errors, first };

  return {
    ok: true,
    realty: {
      id,
      category: form.category,
      price,
      residents,
      garage,
      exteriorUrl: exteriorUrl || undefined,
      interiorUrl: interiorUrl || undefined,
    },
  };
}

type RealtyEditorProps = { mode: "create" } | { mode: "edit"; realty: Realty };

/** Окно добавления и редактирования недвижимости. Справа карточка, какой она будет в каталоге. */
export function RealtyEditor(props: RealtyEditorProps) {
  const router = useRouter();
  const editing = props.mode === "edit";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [initial, setInitial] = useState("");
  // Какое фото сейчас загружается в карточку: у объекта их два
  const [view, setView] = useState<View>("exterior");

  const dirty = open && JSON.stringify(form) !== initial;

  const preview = useMemo<Realty>(
    () => ({
      id: Number(form.id) || 0,
      category: form.category,
      price: Number(form.price) || 0,
      residents: Number(form.residents) || 0,
      garage: Number(form.garage) || 0,
      exteriorUrl: form.exteriorUrl || undefined,
      interiorUrl: form.interiorUrl || undefined,
    }),
    [form],
  );

  const clearError = (key: keyof FormState) =>
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    clearError(key === "interiorUrl" ? "exteriorUrl" : key);
    setServerError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const start = editing ? toForm(props.realty) : emptyForm();
      setInitial(JSON.stringify(start));
      setForm(start);
      setErrors({});
      setServerError(null);
      setView("exterior");
      setOpen(true);
      return;
    }
    if (saving) return;
    if (dirty) setConfirmClose(true);
    else setOpen(false);
  };

  const focusField = (field: string) => {
    requestAnimationFrame(() => {
      const element = document.getElementById(fieldId(field === "exteriorUrl" ? "id" : field));
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
      const endpoint = editing ? `/api/realties/${props.realty.id}` : "/api/realties";
      const response = await fetch(endpoint, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.realty),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        if (response.status === 409) {
          setErrors({ id: "Объект с таким номером уже есть" });
          focusField("id");
        } else {
          setServerError(data.error ?? "Не удалось сохранить");
        }
        return;
      }
      toast.success(editing ? "Изменения сохранены" : "Объект добавлен");
      setInitial(JSON.stringify(form));
      setOpen(false);
      router.refresh();
    } catch {
      setServerError("Нет связи с сервером, попробуйте ещё раз");
    } finally {
      setSaving(false);
    }
  };

  let submitLabel = editing ? "Сохранить" : "Добавить объект";
  if (saving) submitLabel = "Сохраняем...";

  const title = editing ? realtyTitle(props.realty) : "Новый объект";
  const Icon = categoryIcons[form.category];
  const imageKey = view === "exterior" ? "exteriorUrl" : "interiorUrl";
  const hasResidents = form.category === "Дома" || form.category === "Квартиры";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {editing ? (
            <Button
              type="button"
              size="icon-xs"
              variant="secondary"
              aria-label={`Редактировать: ${realtyTitle(props.realty)}`}
              title="Редактировать"
            >
              <Pencil />
            </Button>
          ) : (
            <Button size="sm">
              <Plus data-icon="inline-start" /> Добавить объект
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
            <DialogDescription>
              Справа карточка, какой она будет в каталоге. Картинку можно перетащить прямо на неё или вставить через
              Ctrl+V. Изменения сразу появятся на сайте для всех посетителей.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
            <aside className="flex flex-col gap-3 md:order-2 md:self-start">
              <p className="font-medium text-muted-foreground text-xs">Предпросмотр карточки</p>
              <fieldset className="m-0 flex gap-1.5 border-0 p-0">
                <legend className="sr-only">Какое фото загружаем</legend>
                <Chip pressed={view === "exterior"} onClick={() => setView("exterior")}>
                  Экстерьер
                </Chip>
                <Chip pressed={view === "interior"} onClick={() => setView("interior")}>
                  Интерьер
                </Chip>
              </fieldset>
              <RealtyCard
                realty={preview}
                image={
                  <EstateImageDrop
                    key={view}
                    value={form[imageKey]}
                    onChange={(url) => set(imageKey, url)}
                    icon={Icon}
                    alt={`${realtyTitle(preview)}: ${view === "exterior" ? "экстерьер" : "интерьер"}`}
                    active={open}
                    disabled={saving}
                  />
                }
              />
              {errors.exteriorUrl && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.exteriorUrl}
                </p>
              )}
            </aside>

            <div className="flex flex-col gap-5">
              <Section title="Основное">
                <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
                  <legend className="mb-1.5 font-medium text-sm">Тип недвижимости</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {realtyCategories.map((category) => {
                      const CategoryIcon = categoryIcons[category];
                      return (
                        <Chip
                          key={category}
                          pressed={form.category === category}
                          onClick={() => set("category", category)}
                        >
                          <CategoryIcon aria-hidden="true" /> {category}
                        </Chip>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id="id"
                    label="Номер (ID)"
                    error={errors.id}
                    hint={editing ? "Номер нельзя изменить" : "Впишите вручную, он должен быть уникальным"}
                  >
                    <Input
                      id={fieldId("id")}
                      inputMode="numeric"
                      value={form.id}
                      disabled={editing}
                      aria-invalid={Boolean(errors.id)}
                      placeholder="1557"
                      onChange={(event) => set("id", digitsOnly(event.target.value, 7))}
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
                      placeholder="240000"
                      onChange={(event) => set("price", digitsOnly(event.target.value, 11))}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Характеристики">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id="residents"
                    label="Жильцов"
                    error={errors.residents}
                    hint={hasResidents ? undefined : "У офисов и складов обычно 0"}
                  >
                    <Input
                      id={fieldId("residents")}
                      inputMode="numeric"
                      value={form.residents}
                      aria-invalid={Boolean(errors.residents)}
                      placeholder="0"
                      onChange={(event) => set("residents", digitsOnly(event.target.value, 4))}
                    />
                  </Field>
                  <Field id="garage" label="Гаражных мест" error={errors.garage}>
                    <Input
                      id={fieldId("garage")}
                      inputMode="numeric"
                      value={form.garage}
                      aria-invalid={Boolean(errors.garage)}
                      placeholder="0"
                      onChange={(event) => set("garage", digitsOnly(event.target.value, 4))}
                    />
                  </Field>
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
