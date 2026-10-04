"use client";

import { useId, useMemo, useState, useTransition } from "react";

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
import { Textarea } from "@/components/ui/textarea";

import { createJobAction, updateJobAction } from "../_actions";
import { JOB_LIMITS, type Job, type JobKind, jobKinds } from "../_data/jobs";
import { slugify } from "../_data/slug";

type SectionForm = { title: string; text: string };

type FormState = {
  title: string;
  slug: string;
  kind: JobKind;
  level: string;
  image: string;
  tagline: string;
  intro: string;
  alt1: string;
  alt2: string;
  conditions: string;
  income: string;
  process: string;
  tips: string;
  teamwork: string;
  navigator: string;
  sections: SectionForm[];
};

const toLines = (items: readonly string[] | undefined) => (items ?? []).join("\n");
const fromLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const emptyForm: FormState = {
  title: "",
  slug: "",
  kind: "legal",
  level: "0",
  image: "",
  tagline: "",
  intro: "",
  alt1: "",
  alt2: "",
  conditions: "",
  income: "",
  process: "",
  tips: "",
  teamwork: "",
  navigator: "",
  sections: [],
};

const formFromJob = (job: Job): FormState => ({
  title: job.title,
  slug: job.slug,
  kind: job.kind,
  level: String(job.level),
  image: job.image ?? "",
  tagline: job.tagline,
  intro: job.intro,
  alt1: job.altRanks?.[0] ?? "",
  alt2: job.altRanks?.[1] ?? "",
  conditions: toLines(job.conditions),
  income: toLines(job.income),
  process: toLines(job.process),
  tips: toLines(job.tips),
  teamwork: job.teamwork ?? "",
  navigator: job.navigator ?? "",
  sections: (job.sections ?? []).map((section) => ({ title: section.title, text: toLines(section.items) })),
});

type JobEditorProps = {
  /** Все работы: нужны, чтобы выбрать предыдущий этап для альтернативного пути */
  allJobs: readonly Job[];
} & ({ mode: "create" } | { mode: "edit"; job: Job });

/** Кнопка и окно добавления или изменения работы вместе с её гайдом. Показывается только тем, у кого есть право. */
export function JobEditor(props: JobEditorProps) {
  const router = useRouter();
  const editing = props.mode === "edit";
  const currentSlug = props.mode === "edit" ? props.job.slug : null;
  const fieldId = useId();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  // Пока адрес не правили руками, он строится из названия
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const altOptions = useMemo(
    () => props.allJobs.filter((job) => job.slug !== currentSlug),
    [props.allJobs, currentSlug],
  );

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setForm(props.mode === "edit" ? formFromJob(props.job) : emptyForm);
      setSlugTouched(false);
      setError(null);
    }
    setOpen(next);
  };

  const updateSection = (index: number, patch: Partial<SectionForm>) =>
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) => (i === index ? { ...section, ...patch } : section)),
    }));

  const save = () => {
    setError(null);
    const payload = {
      slug: form.slug,
      title: form.title,
      kind: form.kind,
      level: form.level.trim() === "" ? 0 : Number(form.level),
      altRanks: [form.alt1, form.alt2].filter((slug, i, all) => slug && all.indexOf(slug) === i),
      tagline: form.tagline,
      intro: form.intro,
      conditions: fromLines(form.conditions),
      income: fromLines(form.income),
      process: fromLines(form.process),
      tips: fromLines(form.tips),
      teamwork: form.teamwork,
      navigator: form.navigator,
      image: form.image,
      sections: form.sections
        .map((section) => ({ title: section.title.trim(), items: fromLines(section.text) }))
        .filter((section) => section.title || section.items.length > 0),
    };

    startTransition(async () => {
      try {
        const result = currentSlug ? await updateJobAction(currentSlug, payload) : await createJobAction(payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(editing ? "Гайд сохранён" : "Работа добавлена");
        setOpen(false);
        if (editing) router.refresh();
        else router.push(`/dashboard/jobs/${result.slug}`);
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline" size="sm">
            <Pencil data-icon="inline-start" /> Изменить гайд
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" /> Добавить работу
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Гайд: ${props.job.title}` : "Новая работа"}</DialogTitle>
          <DialogDescription>
            Каждый пункт списка пишите с новой строки. Изменения сразу увидят все посетители раздела.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-title`}>Название</Label>
              <Input
                id={`${fieldId}-title`}
                value={form.title}
                maxLength={JOB_LIMITS.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setForm((prev) => ({
                    ...prev,
                    title,
                    slug: !editing && !slugTouched ? slugify(title) : prev.slug,
                  }));
                }}
                placeholder="Например, Водитель автобуса"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-slug`}>Адрес гайда</Label>
              <Input
                id={`${fieldId}-slug`}
                value={form.slug}
                disabled={editing}
                maxLength={60}
                onChange={(event) => {
                  setSlugTouched(true);
                  set("slug", event.target.value.toLowerCase());
                }}
                placeholder="voditel-avtobusa"
                autoComplete="off"
              />
              <p className="text-muted-foreground text-xs">
                {editing
                  ? "Адрес менять нельзя: на него ведут ссылки."
                  : `Ссылка: /dashboard/jobs/${form.slug || "..."}`}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-kind`}>Тип</Label>
              <NativeSelect
                id={`${fieldId}-kind`}
                className="w-full"
                value={form.kind}
                onChange={(event) => set("kind", event.target.value as JobKind)}
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
                onChange={(event) => set("level", event.target.value)}
              />
              <p className="text-muted-foreground text-xs">0 — доступна сразу</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-image`}>Картинка</Label>
              <Input
                id={`${fieldId}-image`}
                value={form.image}
                maxLength={JOB_LIMITS.image}
                onChange={(event) => set("image", event.target.value)}
                placeholder="/images/jobs/bus.webp или https://"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-tagline`}>Короткое описание для карточки</Label>
            <Input
              id={`${fieldId}-tagline`}
              value={form.tagline}
              maxLength={JOB_LIMITS.tagline}
              onChange={(event) => set("tagline", event.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-intro`}>Вводный абзац</Label>
            <Textarea
              id={`${fieldId}-intro`}
              value={form.intro}
              maxLength={JOB_LIMITS.intro}
              onChange={(event) => set("intro", event.target.value)}
              className="max-h-48 min-h-24"
            />
          </div>

          <fieldset className="flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 font-medium text-sm">Альтернативный путь: 2 ранг на одной из работ</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["alt1", "alt2"] as const).map((key, index) => (
                <NativeSelect
                  key={key}
                  className="w-full"
                  value={form[key]}
                  aria-label={`Предыдущая работа ${index + 1}`}
                  onChange={(event) => set(key, event.target.value)}
                >
                  <option value="">Не выбрано</option>
                  {altOptions.map((job) => (
                    <option key={job.slug} value={job.slug}>
                      {job.title}
                    </option>
                  ))}
                </NativeSelect>
              ))}
            </div>
          </fieldset>

          {(
            [
              ["conditions", "Экипировка и условия", "Что нужно для старта: транспорт, инструменты, лицензии"],
              ["income", "Как зарабатывать", "Из чего складывается доход"],
              ["process", "Процесс работы", "Шаги по порядку, нумерация появится сама"],
              ["tips", "Советы", "Подсказки новичкам"],
            ] as const
          ).map(([key, label, hint]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-${key}`}>{label}</Label>
              <Textarea
                id={`${fieldId}-${key}`}
                value={form[key]}
                onChange={(event) => set(key, event.target.value)}
                placeholder={hint}
                className="max-h-56 min-h-20"
              />
            </div>
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-teamwork`}>Совместная работа</Label>
              <Textarea
                id={`${fieldId}-teamwork`}
                value={form.teamwork}
                maxLength={JOB_LIMITS.teamwork}
                onChange={(event) => set("teamwork", event.target.value)}
                placeholder="Необязательно"
                className="max-h-40 min-h-16"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-navigator`}>Подсказка навигатора</Label>
              <Input
                id={`${fieldId}-navigator`}
                value={form.navigator}
                maxLength={JOB_LIMITS.navigator}
                onChange={(event) => set("navigator", event.target.value)}
                placeholder="F3 → Работа → ..."
                autoComplete="off"
              />
            </div>
          </div>

          <section className="flex flex-col gap-3 rounded-xl border p-4" aria-label="Дополнительные разделы">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-medium text-sm">Дополнительные разделы гайда</h3>
                <p className="text-muted-foreground text-xs">
                  Свои блоки: например, «Маршруты», «Частые ошибки». Попадут в содержание страницы.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={form.sections.length >= JOB_LIMITS.sections}
                onClick={() => set("sections", [...form.sections, { title: "", text: "" }])}
              >
                <Plus data-icon="inline-start" /> Раздел
              </Button>
            </div>

            {form.sections.map((section, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: у разделов нет id, порядок задаёт сам редактор
              <div key={index} className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={section.title}
                    maxLength={JOB_LIMITS.sectionTitle}
                    onChange={(event) => updateSection(index, { title: event.target.value })}
                    placeholder="Заголовок раздела"
                    aria-label={`Заголовок раздела ${index + 1}`}
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Удалить раздел ${index + 1}`}
                    onClick={() =>
                      set(
                        "sections",
                        form.sections.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <Textarea
                  value={section.text}
                  onChange={(event) => updateSection(index, { text: event.target.value })}
                  placeholder="Пункты, каждый с новой строки"
                  aria-label={`Пункты раздела ${index + 1}`}
                  className="max-h-48 min-h-20"
                />
              </div>
            ))}
          </section>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
