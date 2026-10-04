"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import { ArrowLeft, Columns2, Eye, ImagePlus, Pencil, Save } from "lucide-react";
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
  type BlockKind,
  createBlock,
  draftJob,
  type EditorBlock,
  editorBlocksFromJob,
  emptyForm,
  type FormState,
  formFromJob,
  newId,
  toGuideBlocks,
} from "./editor-model";
import { JobArticleView } from "./job-article";
import { type BlockActions, JobBlockEditor } from "./job-block-editor";
import { JobCoverField } from "./job-cover-field";
import { isImageFile, uploadImage } from "./upload-image";

type View = "edit" | "split" | "preview";

type JobEditorPageProps = {
  /** Все работы: нужны для выбора предыдущего этапа и для предпросмотра соседних гайдов */
  allJobs: Job[];
} & ({ mode: "create" } | { mode: "edit"; job: Job });

const snapshot = (form: FormState, blocks: readonly EditorBlock[]) =>
  JSON.stringify({ form, blocks: toGuideBlocks(blocks) });

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

/**
 * Отдельная страница создания и редактирования гайда работы: настройки сверху, ниже блоки (заголовки, текст, списки,
 * советы, картинки) и предпросмотр. Картинки добавляются перетаскиванием в окно или через Ctrl+V.
 */
export function JobEditorPage(props: JobEditorPageProps) {
  const router = useRouter();
  const editing = props.mode === "edit";
  const job = props.mode === "edit" ? props.job : null;
  const currentSlug = job?.slug ?? null;
  const fieldId = useId();

  const [form, setForm] = useState<FormState>(() => (job ? formFromJob(job) : emptyForm));
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => (job ? editorBlocksFromJob(job) : []));
  const [baseline, setBaseline] = useState(() =>
    snapshot(job ? formFromJob(job) : emptyForm, job ? editorBlocksFromJob(job) : []),
  );
  const [view, setView] = useState<View>("edit");
  // Пока адрес не правили руками, он строится из названия
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();

  // Блок, в котором стоит курсор: туда попадёт картинка, вставленная через Ctrl+V
  const focusedId = useRef<string | null>(null);

  const dirty = snapshot(form, blocks) !== baseline;
  const uploading = blocks.some((block) => block.type === "image" && block.uploading);

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

  const addFiles: BlockActions["addFiles"] = (files, targetId, options) => {
    const images = files.filter(isImageFile);
    if (images.length < files.length) toast.error("Подходят только PNG, JPEG, WebP и GIF");
    if (images.length === 0) return;
    if (blocks.length + images.length > JOB_LIMITS.blocks) {
      toast.error(`Не больше ${JOB_LIMITS.blocks} блоков в одном гайде`);
      return;
    }

    const items = images.map((file) => ({ file, id: newId(), local: URL.createObjectURL(file) }));

    setBlocks((prev) => {
      const next = [...prev];
      const queue = [...items];
      const targetIndex = targetId ? next.findIndex((block) => block.id === targetId) : -1;
      const target = targetIndex >= 0 ? next[targetIndex] : undefined;

      // Пустой блок с картинкой заполняется первым файлом; при «Заменить» заменяется и заполненный
      if (target?.type === "image" && (options?.replace || (!target.src && !target.local))) {
        const first = queue.shift();
        if (first) next[targetIndex] = { ...target, src: "", local: first.local, uploading: true, error: undefined };
      }
      const at = targetIndex >= 0 ? targetIndex + 1 : next.length;
      next.splice(
        at,
        0,
        ...queue.map(
          (item): EditorBlock => ({ id: item.id, type: "image", src: "", caption: "", local: item.local, uploading: true }),
        ),
      );
      return next;
    });

    const finish = (local: string, patch: Partial<Extract<EditorBlock, { type: "image" }>>) =>
      setBlocks((prev) =>
        prev.map((block) => (block.type === "image" && block.local === local ? { ...block, ...patch } : block)),
      );

    for (const item of items) {
      uploadImage(item.file).then(
        (url) => {
          finish(item.local, { src: url, local: undefined, uploading: false, error: undefined });
          URL.revokeObjectURL(item.local);
        },
        (reason: unknown) => {
          const message = reason instanceof Error ? reason.message : "Не удалось загрузить картинку";
          finish(item.local, { uploading: false, error: message });
          toast.error(message);
        },
      );
    }
  };

  const actions: BlockActions = {
    update: (id, patch) =>
      setBlocks((prev) => prev.map((block) => (block.id === id ? ({ ...block, ...patch } as EditorBlock) : block))),
    remove: (id) => {
      if (focusedId.current === id) focusedId.current = null;
      setBlocks((prev) => prev.filter((block) => block.id !== id));
    },
    move: (id, direction) =>
      setBlocks((prev) => {
        const index = prev.findIndex((block) => block.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      }),
    duplicate: (id) =>
      setBlocks((prev) => {
        const index = prev.findIndex((block) => block.id === id);
        if (index < 0 || prev.length >= JOB_LIMITS.blocks) return prev;
        const copy = { ...prev[index], id: newId() } as EditorBlock;
        return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
      }),
    insert: (kind: BlockKind, afterId) => {
      const block = createBlock(kind);
      focusedId.current = block.id;
      setBlocks((prev) => {
        const index = afterId ? prev.findIndex((item) => item.id === afterId) : -1;
        const at = index >= 0 ? index + 1 : afterId === null ? 0 : prev.length;
        return [...prev.slice(0, at), block, ...prev.slice(at)];
      });
    },
    addFiles,
  };

  // Ctrl+V: картинка из буфера обмена (скриншот или скопированный файл) становится блоком
  // Перетаскивание: файлы можно бросить в любое место окна; если бросить на блок, картинка встанет после него
  useEffect(() => {
    let depth = 0;

    const onPaste = (event: ClipboardEvent) => {
      if (view === "preview") return;
      const files = Array.from(event.clipboardData?.files ?? []).filter(isImageFile);
      if (files.length === 0) return;
      event.preventDefault();
      addFiles(files, focusedId.current);
    };

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setDragging(view !== "preview");
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      // Обложка принимает файлы сама
      if ((event.target as Element | null)?.closest?.("[data-cover-drop]")) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = view === "preview" ? "none" : "copy";
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = 0;
      setDragging(false);
      if ((event.target as Element | null)?.closest?.("[data-cover-drop]")) return;
      // Без этого браузер открыл бы файл в этой вкладке и уничтожил несохранённый гайд
      event.preventDefault();
      if (view === "preview") return;
      const target = (event.target as Element | null)?.closest?.("[data-block-id]");
      addFiles(Array.from(event.dataTransfer?.files ?? []), target?.getAttribute("data-block-id") ?? null);
    };

    document.addEventListener("paste", onPaste);
    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  });

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
    if (blocks.some((block) => block.type === "image" && !block.src && block.error)) {
      setError("Одна из картинок не загрузилась: выберите файл заново или удалите этот блок");
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
      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/70 p-6 backdrop-blur-[2px]"
        >
          <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-primary border-dashed bg-card px-10 py-8 text-center shadow-lg">
            <ImagePlus className="size-8 text-primary" />
            <p className="font-semibold text-lg">Отпустите, чтобы добавить картинку</p>
            <p className="text-muted-foreground text-sm">Бросьте на блок — она встанет после него</p>
          </div>
        </div>
      )}

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
            onFocusCapture={(event) => {
              const block = (event.target as Element).closest("[data-block-id]");
              if (block) focusedId.current = block.getAttribute("data-block-id");
            }}
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
              <div>
                <h2 className="font-semibold text-base">Содержимое гайда</h2>
                <p className="text-muted-foreground text-xs">
                  Заголовки попадают в содержание страницы. Пустые блоки при сохранении отбрасываются.
                </p>
              </div>
              <JobBlockEditor blocks={blocks} actions={actions} />
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
    </main>
  );
}
