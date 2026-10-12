"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { JOB_LIMITS, type Job, type JobKind, jobKinds } from "../_data/jobs";
import type { FormState } from "./editor-model";
import { JobCoverField } from "./job-cover-field";

type JobSettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormState;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  /** Адрес правится только у новой работы: на старый ведут ссылки */
  editing: boolean;
  onSlugTouched: () => void;
  /** Работы, из которых можно выбрать предыдущий этап */
  altOptions: Job[];
};

/** Всё, что не входит в сам текст гайда: адрес, тип, уровень, обложка, описание для карточки и предыдущие этапы. */
export function JobSettingsSheet({
  open,
  onOpenChange,
  form,
  onChange,
  editing,
  onSlugTouched,
  altOptions,
}: JobSettingsSheetProps) {
  const fieldId = useId();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Настройки страницы</SheetTitle>
          <SheetDescription>Адрес, доступ и то, как работа выглядит в списке.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-slug`}>Адрес страницы</Label>
            <Input
              id={`${fieldId}-slug`}
              value={form.slug}
              disabled={editing}
              maxLength={60}
              onChange={(event) => {
                onSlugTouched();
                onChange("slug", event.target.value.toLowerCase());
              }}
              placeholder="voditel-avtobusa"
              autoComplete="off"
            />
            <p className="text-muted-foreground text-xs">
              {editing ? "Адрес менять нельзя: на него ведут ссылки." : `Ссылка: /jobs/${form.slug || "..."}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-kind`}>Тип</Label>
              <NativeSelect
                id={`${fieldId}-kind`}
                className="w-full"
                value={form.kind}
                onChange={(event) => onChange("kind", event.target.value as JobKind)}
              >
                {(Object.keys(jobKinds) as JobKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {jobKinds[kind].title}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-level`}>Уровень доступа</Label>
              <Input
                id={`${fieldId}-level`}
                type="number"
                min={0}
                max={JOB_LIMITS.level}
                value={form.level}
                onChange={(event) => onChange("level", event.target.value)}
              />
            </div>
          </div>
          <p className="-mt-3 text-muted-foreground text-xs">Уровень 0 — работа доступна сразу.</p>

          <JobCoverField id={`${fieldId}-image`} value={form.image} onChange={(value) => onChange("image", value)} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-tagline`}>Короткое описание для карточки</Label>
            <Textarea
              id={`${fieldId}-tagline`}
              value={form.tagline}
              maxLength={JOB_LIMITS.tagline}
              onChange={(event) => onChange("tagline", event.target.value)}
              className="max-h-40 min-h-16"
            />
          </div>

          <fieldset className="flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 font-medium text-sm">Альтернативный путь: 2 ранг на одной из работ</legend>
            {(["alt1", "alt2"] as const).map((key, index) => (
              <NativeSelect
                key={key}
                className="w-full"
                value={form[key]}
                aria-label={`Предыдущая работа ${index + 1}`}
                onChange={(event) => onChange(key, event.target.value)}
              >
                <option value="">Не выбрано</option>
                {altOptions.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.title}
                  </option>
                ))}
              </NativeSelect>
            ))}
          </fieldset>
        </div>
      </SheetContent>
    </Sheet>
  );
}
