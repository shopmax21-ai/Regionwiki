"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Pencil, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { updateJobAction } from "../_actions";
import { type GuideBlock, JOB_LIMITS, type Job } from "../_data/jobs";
import { DropOverlay } from "./drop-overlay";
import { editorBlocksFromJob, toGuideBlocks } from "./editor-model";
import { GuideDocEditor } from "./guide-doc-editor";
import { GuideTemplatesDialog } from "./guide-templates-dialog";
import { JobAccessEditor } from "./job-access-editor";
import { JobArticleView } from "./job-article-view";
import { JobDelete } from "./job-delete";
import { useGuideBlocks } from "./use-guide-blocks";

type Props = { job: Job; jobs: Job[] };
type Saved = { blocks: GuideBlock[]; level: number; altRanks: string[] };

/**
 * Страница гайда для редакторов: обычный вид с кнопкой «Править здесь».
 * В режиме правки разделы гайда становятся редактором-документом (как в GitBook), а настройки (название, обложка, доступ) остаются как есть.
 */
export function JobArticleEditable({ job, jobs }: Props) {
  const [editing, setEditing] = useState(false);
  // Сразу после сохранения показываем новые блоки, не дожидаясь, пока страница перечитает данные с сервера
  const [saved, setSaved] = useState<Saved | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: сбрасываем локальную копию, когда с сервера пришла новая версия гайда
  useEffect(() => {
    setSaved(null);
  }, [job]);

  const shown = useMemo(() => (saved ? { ...job, ...saved } : job), [job, saved]);
  const shownJobs = useMemo(() => jobs.map((item) => (item.slug === job.slug ? shown : item)), [jobs, job.slug, shown]);

  if (editing) {
    return (
      <InlineEditing
        job={shown}
        jobs={shownJobs}
        onClose={() => setEditing(false)}
        onSaved={(result) => {
          setSaved(result);
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
        <Link href={`/jobs/${job.slug}/edit`} prefetch={false}>
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
}: Props & { onClose: () => void; onSaved: (saved: Saved) => void }) {
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
  // Условия доступа правятся здесь же, рядом с текстом гайда
  const [level, setLevel] = useState(() => String(job.level));
  const [altRanks, setAltRanks] = useState<string[]>(() => job.altRanks ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const levelValue = level.trim() === "" ? 0 : Number(level);
  const accessDirty = levelValue !== job.level || altRanks.join("\n") !== (job.altRanks ?? []).join("\n");
  const dirty = accessDirty || JSON.stringify(toGuideBlocks(blocks)) !== baseline;
  let statusText = "Изменений пока нет";
  if (uploading) statusText = "Загружаем картинки…";
  else if (dirty) statusText = "Есть несохранённые изменения";

  // Страница вокруг редактора обновляется на лету: содержание слева строится по тому, что набрано сейчас
  const draft = useMemo<Job>(
    () => ({
      ...job,
      level: Number.isFinite(levelValue) ? levelValue : job.level,
      altRanks,
      blocks: toGuideBlocks(blocks, { preview: true }),
    }),
    [job, blocks, levelValue, altRanks],
  );
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

    if (!Number.isInteger(levelValue) || levelValue < 0 || levelValue > JOB_LIMITS.level) {
      setError(`Уровень доступа: целое число от 0 до ${JOB_LIMITS.level}`);
      return;
    }

    const next = toGuideBlocks(blocks);
    const payload = {
      slug: job.slug,
      title: job.title,
      kind: job.kind,
      level: levelValue,
      altRanks,
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
        onSaved({ blocks: next, level: levelValue, altRanks });
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

  // Ctrl+S / Ctrl+Enter (и Cmd) сохраняют гайд, а не страницу
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "s" || event.key === "Enter")) {
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

      <JobArticleView
        job={draft}
        jobs={draftJobs}
        accessSlot={
          <JobAccessEditor
            level={level}
            altRanks={altRanks}
            options={otherJobs}
            onLevelChange={setLevel}
            onAltRanksChange={setAltRanks}
          />
        }
        guideSlot={
          <div className="rounded-xl border bg-card p-4 shadow-xs sm:p-6">
            <GuideDocEditor inline blocks={blocks} actions={actions} />
          </div>
        }
      />

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
