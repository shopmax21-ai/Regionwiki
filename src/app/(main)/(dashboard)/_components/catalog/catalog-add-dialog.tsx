"use client";

import { type FormEvent, useId, useState } from "react";

import { cn } from "cn";
import { Plus } from "lucide-react";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { useCatalogStore } from "./catalog-store";
import type { CatalogDetailSection, CatalogSpecField } from "./catalog-types";
import { defaultDetails } from "./catalog-utils";

interface CatalogAddDialogProps {
  addLabel: string;
  title: string;
  description: string;
  namePlaceholder: string;
  kindLabel: string;
  ownerLabel: string;
  sharedLabel: string;
  addedMessage: string;
  sections: CatalogDetailSection[];
}

interface SpecInputProps {
  field: CatalogSpecField;
  id: string;
  value: string;
  onChange: (value: string) => void;
}

function SpecInput({ field, id, value, onChange }: SpecInputProps) {
  const label = field.unit ? `${field.label}, ${field.unit}` : field.label;

  if (field.type === "boolean") {
    return (
      <Field orientation="horizontal">
        <Switch id={id} checked={value === "yes"} onCheckedChange={(checked) => onChange(checked ? "yes" : "no")} />
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      </Field>
    );
  }

  return (
    <Field className={cn(field.type === "textarea" && "sm:col-span-2")}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {field.type === "select" && (
        <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {field.options?.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      {field.type === "textarea" && (
        <Textarea
          id={id}
          value={value}
          rows={3}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {(field.type === "number" || field.type === "money") && (
        <Input
          id={id}
          value={value}
          inputMode="numeric"
          placeholder={field.placeholder ?? "0"}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        />
      )}
      {field.type === "text" && (
        <Input
          id={id}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export function CatalogAddDialog({
  addLabel,
  title,
  description,
  namePlaceholder,
  kindLabel,
  ownerLabel,
  sharedLabel,
  addedMessage,
  sections,
}: CatalogAddDialogProps) {
  const { kinds, defaultOwner, addEntry } = useCatalogStore();
  const id = useId();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState(kinds[0]?.value ?? "");
  const [price, setPrice] = useState("");
  const [owner, setOwner] = useState("");
  const [shared, setShared] = useState(true);
  const [isNew, setIsNew] = useState(false);
  const [details, setDetails] = useState(() => defaultDetails(sections));
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setKind(kinds[0]?.value ?? "");
    setPrice("");
    setOwner("");
    setShared(true);
    setIsNew(false);
    setDetails(defaultDetails(sections));
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (name.trim().length < 2) {
      setError("Введите название (минимум 2 символа).");
      return;
    }

    addEntry({ name, kind, price, owner, shared, isNew, details });
    toast.success(addedMessage, { description: name.trim() });
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          {addLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={`${id}-name`}>Название</FieldLabel>
              <Input
                id={`${id}-name`}
                value={name}
                placeholder={namePlaceholder}
                aria-invalid={error ? true : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  if (error) setError(null);
                }}
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${id}-kind`}>{kindLabel}</FieldLabel>
                <NativeSelect id={`${id}-kind`} value={kind} onChange={(event) => setKind(event.target.value)}>
                  {kinds.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-price`}>Цена, $</FieldLabel>
                <Input
                  id={`${id}-price`}
                  value={price}
                  inputMode="numeric"
                  placeholder="14500"
                  onChange={(event) => setPrice(event.target.value)}
                />
              </Field>
            </div>
            <FieldDescription className="-mt-2">
              Цену можно оставить пустой, если позиция не продаётся.
            </FieldDescription>
            <Field>
              <FieldLabel htmlFor={`${id}-owner`}>{ownerLabel}</FieldLabel>
              <Input
                id={`${id}-owner`}
                value={owner}
                placeholder={defaultOwner}
                onChange={(event) => setOwner(event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field orientation="horizontal">
                <Switch id={`${id}-shared`} checked={shared} onCheckedChange={setShared} />
                <FieldLabel htmlFor={`${id}-shared`}>{sharedLabel}</FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Switch id={`${id}-new`} checked={isNew} onCheckedChange={setIsNew} />
                <FieldLabel htmlFor={`${id}-new`}>Отметить как «Новый»</FieldLabel>
              </Field>
            </div>
          </FieldGroup>

          {sections.map((section) => (
            <FieldSet key={section.id}>
              <FieldLegend variant="label">{section.title}</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <SpecInput
                    key={field.key}
                    field={field}
                    id={`${id}-${field.key}`}
                    value={details[field.key] ?? ""}
                    onChange={(value) => setDetails((current) => ({ ...current, [field.key]: value }))}
                  />
                ))}
              </div>
            </FieldSet>
          ))}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit">{addLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
