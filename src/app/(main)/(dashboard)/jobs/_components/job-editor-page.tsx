"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, Eye, Pencil, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { createJobAction, updateJobAction } from "../_actions";
import { JOB_LIMITS, type Job } from "../_data/jobs";
import { slugify } from "../_data/slug";
import { DropOverlay } from "./drop-overlay";
import {
  draftJob,
  type EditorBlock,
  editorBlocksFromJob,
  emptyForm,
  type FormState,
  formFromJob,
  toGuideBlocks,
} from "./editor-model";
import { focusField, GuideDocEditor, PlainArea } from "./guide-doc-editor";
import { GuideTemplatesDialog } from "./guide-templates-dialog";
import { JobArticleView } from "./job-article-view";
import { JobSettingsSheet } from "./job-settings-sheet";
import { useGuideBlocks } from "./use-guide-blocks";

type View = "edit" | "preview";

type JobEditorPageProps = {
  /** Все работы: нужны для выбора предыдущего этапа и для предпросмотра соседних гайдов */
  allJobs: Job[];
} & ({ mode: "create" } | { mode: "edit"; job: Job });

const snapshot = (form: FormState, blocks: readonly EditorBlock[]) =>
  JSON.stringify({ form, blocks: toGuideBlocks(blocks) });

/**
 * Страница создания и редактирования гайда в духе GitBook: сверху тонкая панель (настройки, предпросмотр, сохранить),
 * ниже один столбец документа. Заголовок, вводный абзац и блоки пишутся прямо на странице, «/» открывает список блоков.
 * Картинки добавляются перетаскиванием в окно или через Ctrl+V.
 */
export function JobEditorPage(props: JobEditorPageProps) {
  const router = useRouter();
  const editing = props.mode === "edit";
  const job = props.mode === "edit" ? props.job : null;
  const currentSlug = job?.slug ?? null;

  const [form, setForm] = useState<FormState>(() => (job ? formFromJob(job) : emptyForm));
  const [baseline, setBaseline] = useState(() =>
    snapshot(job ? formFromJob(job) : emptyForm, job ? editorBlocksFromJob(job) : []),
  );
  const [view, setView] = useState<View>("edit");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    blocks,
    actions,
    insertBlocks,
    uploading,
    uploadFailed,
    dragging,
    trackFocus,
    templatesTarget,
    closeTemplates,
  } = useGuideBlocks(() => (job ? editorBlocksFromJob(job) : []), view === "edit");
  // Пока адрес не правили руками, он строится из названия
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const introRef = useRef<HTMLDivElement>(null);

  const dirty = snapshot(form, blocks) !== baseline;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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
        router.push(`/jobs/${result.slug}`);
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

  const backHref = currentSlug ? `/jobs/${currentSlug}` : "/jobs";
  let status = editing ? "Все изменения сохранены" : "Черновик";
  if (dirty) status = "Есть несохранённые изменения";
  if (uploading) status = "Загружаем картинки…";

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col">
      {dragging && view === "edit" && <DropOverlay />}

      <header className="sticky top-[var(--dashboard-header-height)] z-20 -mx-4 -mt-4 flex h-12 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur md:-mx-6 md:-mt-6 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label={editing ? "К гайду" : "Все работы"}>
            <Link
              href={backHref}
              prefetch={false}
              onClick={(event) => {
                if (dirty && !window.confirm("Есть несохранённые изменения. Выйти без сохранения?"))
                  event.preventDefault();
              }}
            >
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium text-sm">{form.title.trim() || "Новая работа"}</span>
            <span className="truncate text-muted-foreground text-xs" role="status">
              {status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => {
              if (value) setView(value as View);
            }}
            aria-label="Режим страницы"
          >
            <ToggleGroupItem value="edit" aria-label="Редактор">
              <Pencil /> <span className="max-sm:hidden">Редактор</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" aria-label="Предпросмотр">
              <Eye /> <span className="max-sm:hidden">Предпросмотр</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <SlidersHorizontal data-icon="inline-start" /> <span className="max-sm:hidden">Настройки</span>
          </Button>
          <Button size="sm" onClick={save} disabled={pending || uploading}>
            <Save data-icon="inline-start" /> {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mx-auto mt-4 w-full max-w-3xl rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {error}
        </p>
      )}

      {view === "edit" ? (
        <article className="mx-auto w-full max-w-3xl pt-10 pb-32 lg:pt-14" onFocusCapture={trackFocus}>
          <PlainArea
            singleLine
            value={form.title}
            label="Название работы"
            placeholder="Название работы"
            maxLength={JOB_LIMITS.title}
            className="font-bold text-4xl tracking-tight"
            onChange={(title) =>
              setForm((prev) => ({
                ...prev,
                title,
                slug: !editing && !slugTouched ? slugify(title) : prev.slug,
              }))
            }
            onEnter={() => introRef.current?.querySelector("textarea")?.focus()}
          />
          <div ref={introRef} className="mt-3 mb-8">
            <PlainArea
              value={form.intro}
              label="Вводный абзац"
              placeholder="Коротко о том, что это за работа и кому подойдёт"
              maxLength={JOB_LIMITS.intro}
              className="text-lg text-muted-foreground leading-7"
              onChange={(intro) => set("intro", intro)}
              onEnter={() => {
                const first = blocks[0];
                if (first) focusField(first.id);
              }}
            />
          </div>

          <GuideDocEditor blocks={blocks} actions={actions} />
        </article>
      ) : (
        <section aria-label="Предпросмотр" className="mx-auto w-full max-w-5xl pt-8">
          <JobArticleView job={draft} jobs={previewJobs} preview />
        </section>
      )}

      <JobSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        form={form}
        onChange={set}
        editing={editing}
        onSlugTouched={() => setSlugTouched(true)}
        altOptions={altOptions}
      />

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
