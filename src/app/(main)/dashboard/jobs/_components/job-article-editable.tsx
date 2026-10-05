"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Pencil, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { updateJobAction } from "../_actions";
import type { GuideBlock, Job } from "../_data/jobs";
import { DropOverlay } from "./drop-overlay";
import { editorBlocksFromJob, toGuideBlocks } from "./editor-model";
import { GuideCanvas } from "./guide-canvas";
import { GuideTemplatesDialog } from "./guide-templates-dialog";
import { JobArticleView } from "./job-article-view";
import { JobDelete } from "./job-delete";
import { useGuideBlocks } from "./use-guide-blocks";

type Props = { job: Job; jobs: Job[] };

/**
 * Страница гайда для редакторов: обычный вид с кнопкой «Править здесь».
 * В режиме правки разделы гайда становятся редактором, а настройки (название, обложка, доступ) остаются как есть.
 */
export function JobArticleEditable({ job, jobs }: Props) {
  const [editing, setEditing] = useState(false);
  // Сразу после сохранения показываем новые блоки, не дожидаясь, пока страница перечитает данные с сервера
  const [saved, setSaved] = useState<GuideBlock[] | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: сбрасываем локальную копию, когда с сервера пришла новая версия гайда
  useEffect(() => {
    setSaved(null);
  }, [job]);

  const shown = useMemo(() => (saved ? { ...job, blocks: saved } : job), [job, saved]);
  const shownJobs = useMemo(() => jobs.map((item) => (item.slug === job.slug ? shown : item)), [jobs, job.slug, shown]);

  if (editing) {
    return (
      <InlineEditing
        job={shown}
        jobs={shownJobs}
        onClose={() => setEditing(false)}
        onSaved={(blocks) => {
          setSaved(blocks);
          setEditing(false);
        }}
      />
    );
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => setEditing(true)}>
        <Pencil data-icon="inline-start" /> Править здесь
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/dashboard/jobs/${job.slug}/edit`} prefetch={false}>
          Все настройки
        </Link>
      </Button>
      <JobDelete slug={job.slug} title={job.title} />
    </div>
  );

  return <JobArticleView job={shown} jobs={shownJobs} actions={actions} />;
}

function InlineEditing({
  job,
  jobs,
  onClose,
  onSaved,
}: Props & { onClose: () => void; onSaved: (blocks: GuideBlock[]) => void }) {
  const router = useRouter();
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
  } = useGuideBlocks(() => editorBlocksFromJob(job), true);
  const [baseline] = useState(() => JSON.stringify(toGuideBlocks(editorBlocksFromJob(job))));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(toGuideBlocks(blocks)) !== baseline;
  let statusText = "Изменений пока нет";
  if (uploading) statusText = "Загружаем картинки…";
  else if (dirty) statusText = "Есть несохранённые изменения";

  // Страница вокруг редактора обновляется на лету: содержание слева строится по тому, что набрано сейчас
  const draft = useMemo<Job>(() => ({ ...job, blocks: toGuideBlocks(blocks, { preview: true }) }), [job, blocks]);
  const draftJobs = useMemo(() => jobs.map((item) => (item.slug === job.slug ? draft : item)), [jobs, job.slug, draft]);
  const otherJobs = useMemo(() => jobs.filter((item) => item.slug !== job.slug), [jobs, job.slug]);

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

    const next = toGuideBlocks(blocks);
    const payload = {
      slug: job.slug,
      title: job.title,
      kind: job.kind,
      level: job.level,
      altRanks: job.altRanks ?? [],
      tagline: job.tagline,
      intro: job.intro,
      image: job.image ?? "",
      // Содержимое целиком лежит в блоках, старые поля очищаются
      conditions: [],
      income: [],
      process: [],
      tips: [],
      sections: [],
      blocks: next,
    };

    startTransition(async () => {
      try {
        const result = await updateJobAction(job.slug, payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success("Гайд сохранён");
        onSaved(next);
        router.refresh();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  const cancel = () => {
    if (dirty && !window.confirm("Есть несохранённые изменения. Выйти без сохранения?")) return;
    onClose();
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

  return (
    <div onFocusCapture={trackFocus}>
      {dragging && <DropOverlay />}

      <JobArticleView job={draft} jobs={draftJobs} guideSlot={<GuideCanvas blocks={blocks} actions={actions} />} />

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="min-w-0 text-sm" role="status">
          {error ? (
            <span role="alert" className="text-destructive">
              {error}
            </span>
          ) : (
            <span className="text-muted-foreground">{statusText}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={cancel} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={save} disabled={pending || uploading || !dirty}>
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
        otherJobs={otherJobs}
        onInsert={(additions) => insertBlocks(additions, templatesTarget?.afterId ?? null)}
      />
    </div>
  );
}
