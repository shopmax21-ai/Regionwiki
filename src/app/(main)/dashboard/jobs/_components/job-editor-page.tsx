"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import { ArrowLeft, Columns2, Eye, LayoutList, MousePointerClick, Pencil, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { createJobAction, updateJobAction } from "../_actions";
import { JOB_LIMITS, type Job, type JobKind, jobKinds } from "../_data/jobs";
import { slugify } from "../_data/slug";
import {
  draftJob,
  type EditorBlock,
  editorBlocksFromJob,
  emptyForm,
  type FormState,
  formFromJob,
  toGuideBlocks,
} from "./editor-model";
import { GuideCanvas } from "./guide-canvas";
import { GuideTemplatesDialog } from "./guide-templates-dialog";
import { JobArticleView } from "./job-article-view";
import { JobBlockEditor } from "./job-block-editor";
import { DropOverlay } from "./drop-overlay";
import { JobCoverField } from "./job-cover-field";
import { useGuideBlocks } from "./use-guide-blocks";

type View = "edit" | "split" | "preview";

/** Как редактируются блоки: карточками с полями или прямо на странице гайда */
type ContentMode = "cards" | "page";

type JobEditorPageProps = {
  /** Все работы: нужны для выбора предыдущего этапа и для предпросмотра соседних гайдов */
  allJobs: Job[];
} & ({ mode: "create" } | { mode: "edit"; job: Job });

const snapshot = (form: FormState, blocks: readonly EditorBlock[]) =>
  JSON.stringify({ form, blocks: toGuideBlocks(blocks) });

/**
 * Отдельная страница создания и редактирования гайда работы: настройки сверху, ниже блоки (заголовки, текст, списки,
 * советы, картинки и слайдеры) и предпросмотр. Картинки добавляются перетаскиванием в окно или через Ctrl+V.
 */
export function JobEditorPage(props: JobEditorPageProps) {
  const router = useRouter();
  const editing = props.mode === "edit";
  const job = props.mode === "edit" ? props.job : null;
  const currentSlug = job?.slug ?? null;
  const fieldId = useId();

  const [form, setForm] = useState<FormState>(() => (job ? formFromJob(job) : emptyForm));
  const [baseline, setBaseline] = useState(() =>
    snapshot(job ? formFromJob(job) : emptyForm, job ? editorBlocksFromJob(job) : []),
  );
  const [view, setView] = useState<View>("edit");
  const [contentMode, setContentMode] = useState<ContentMode>("cards");
  const { blocks, actions, insertBlocks, uploading, uploadFailed, dragging, trackFocus, templatesTarget, closeTemplates } =
    useGuideBlocks(() => (job ? editorBlocksFromJob(job) : []), view !== "preview");
  // Пока адрес не правили руками, он строится из названия
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = snapshot(form, blocks) !== baseline;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const altOptions = useMemo(
    () => props.allJobs.filter((item) => item.slug !== currentSlug),
    [props.allJobs, currentSlug],
  );

  const draft = useMemo(() => draftJob(form, blocks), [form, blocks]);
  const previewJobs = useMemo(() => {
    if (currentSlug) return props.allJobs.map((item) => (item.slug === currentSlug ? draft : item));
    return [...props.allJobs, draft];
  }, [props.allJobs, currentSlug, draft]);

  // Не даём закрыть вкладку с несохранёнными изменениями
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = () => {
    setError(null);
    if (uploading) {
      setError("Дождитесь окончания загрузки картинок");
      return;
    }
    if (uploadFailed) {
      setError("Одна из картинок не загрузилась: выберите файл заново или удалите её");
      return;
    }

    const payload = {
      slug: form.slug,
      title: form.title,
      kind: form.kind,
      level: form.level.trim() === "" ? 0 : Number(form.level),
      altRanks: [form.alt1, form.alt2].filter((slug, i, all) => slug && all.indexOf(slug) === i),
      tagline: form.tagline,
      intro: form.intro,
      image: form.image,
      // Содержимое целиком лежит в блоках, старые поля очищаются
      conditions: [],
      income: [],
      process: [],
      tips: [],
      sections: [],
      blocks: toGuideBlocks(blocks),
    };

    startTransition(async () => {
      try {
        const result = currentSlug ? await updateJobAction(currentSlug, payload) : await createJobAction(payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(editing ? "Гайд сохранён" : "Работа добавлена");
        setBaseline(snapshot(form, blocks));
        router.push(`/dashboard/jobs/${result.slug}`);
        router.refresh();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  // Ctrl+S / Cmd+S сохраняют гайд, а не страницу
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!pending) save();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const backHref = currentSlug ? `/dashboard/jobs/${currentSlug}` : "/dashboard/jobs";
  const showEditor = view !== "preview";
  const showPreview = view !== "edit";

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-5">
      {dragging && view !== "preview" && <DropOverlay />}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            prefetch={false}
            onClick={(event) => {
              if (dirty && !window.confirm("Есть несохранённые изменения. Выйти без сохранения?")) event.preventDefault();
            }}
            className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {editing ? "К гайду" : "Все работы"}
          </Link>

          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => {
              if (value) setView(value as View);
            }}
            aria-label="Режим просмотра"
          >
            <ToggleGroupItem value="edit" aria-label="Только редактор">
              <Pencil /> Редактор
            </ToggleGroupItem>
            <ToggleGroupItem value="split" aria-label="Редактор и предпросмотр рядом" className="hidden lg:flex">
              <Columns2 /> Рядом
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" aria-label="Только предпросмотр">
              <Eye /> Предпросмотр
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {editing ? `Редактирование: ${job?.title}` : "Новая работа"}
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Собирайте гайд из блоков. Картинку можно перетащить в окно или вставить через Ctrl+V — она сразу
            загрузится. Изменения увидят все посетители раздела после сохранения.
          </p>
        </div>
      </header>

      <div className={cn("grid items-start gap-6", view === "split" ? "lg:grid-cols-2" : "grid-cols-1")}>
        {showEditor && (
          <div
            className="flex min-w-0 flex-col gap-6"
            onFocusCapture={trackFocus}
          >
            <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs" aria-label="Основное">
              <h2 className="font-semibold text-base">Основное</h2>

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

              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <JobCoverField id={`${fieldId}-image`} value={form.image} onChange={(value) => set("image", value)} />

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
                  className="max-h-60 min-h-24"
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
                      {altOptions.map((item) => (
                        <option key={item.slug} value={item.slug}>
                          {item.title}
                        </option>
                      ))}
                    </NativeSelect>
                  ))}
                </div>
              </fieldset>
            </section>

            <section className="flex flex-col gap-3" aria-label="Содержимое гайда">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-base">Содержимое гайда</h2>
                  <p className="text-muted-foreground text-xs">
                    Заголовки попадают в содержание страницы. Пустые блоки при сохранении отбрасываются.
                  </p>
                </div>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={contentMode}
                  onValueChange={(value) => {
                    if (value) setContentMode(value as ContentMode);
                  }}
                  aria-label="Способ редактирования блоков"
                >
                  <ToggleGroupItem value="cards" aria-label="Редактировать в карточках">
                    <LayoutList /> Карточки
                  </ToggleGroupItem>
                  <ToggleGroupItem value="page" aria-label="Редактировать прямо на странице">
                    <MousePointerClick /> На странице
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              {contentMode === "page" ? (
                <GuideCanvas blocks={blocks} actions={actions} />
              ) : (
                <JobBlockEditor blocks={blocks} actions={actions} />
              )}
            </section>
          </div>
        )}

        {showPreview && (
          <section
            aria-label="Предпросмотр"
            className={cn(
              "min-w-0 rounded-2xl border bg-muted/20 p-3 md:p-4",
              view === "split" && "lg:sticky lg:top-16 lg:max-h-[calc(100svh-8rem)] lg:overflow-y-auto",
            )}
          >
            <p className="mb-3 flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              <Eye className="size-3.5" aria-hidden="true" /> Так гайд увидят посетители
            </p>
            <JobArticleView job={draft} jobs={previewJobs} preview />
          </section>
        )}
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="min-w-0 text-sm" role="status">
          {error ? (
            <span role="alert" className="text-destructive">
              {error}
            </span>
          ) : uploading ? (
            <span className="text-muted-foreground">Загружаем картинки…</span>
          ) : dirty ? (
            <span className="text-muted-foreground">Есть несохранённые изменения</span>
          ) : (
            <span className="text-muted-foreground">Все изменения сохранены</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" disabled={pending}>
            <Link
              href={backHref}
              prefetch={false}
              onClick={(event) => {
                if (dirty && !window.confirm("Есть несохранённые изменения. Выйти без сохранения?")) event.preventDefault();
              }}
            >
              Отмена
            </Link>
          </Button>
          <Button onClick={save} disabled={pending || uploading}>
            <Save data-icon="inline-start" /> {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </div>

      <GuideTemplatesDialog
        open={templatesTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeTemplates();
        }}
        blocks={blocks}
        otherJobs={altOptions}
        onInsert={(additions) => insertBlocks(additions, templatesTarget?.afterId ?? null)}
      />
    </main>
  );
}
