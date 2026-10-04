"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { LayoutTemplate, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { type GuideBlock, type Job, jobBlocks } from "../_data/jobs";
import { type EditorBlock, guideTemplates, toEditorBlocks, toGuideBlocks } from "./editor-model";
import {
  addTemplate,
  loadTemplates,
  MAX_STORED_TEMPLATES,
  removeTemplate,
  splitIntoSections,
  type StoredTemplate,
  type TemplateSection,
} from "./guide-template-store";

type GuideTemplatesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Текущие блоки гайда: из них можно собрать свой шаблон */
  blocks: readonly EditorBlock[];
  /** Другие гайды: из них можно взять готовые разделы */
  otherJobs: Job[];
  /** Вставляет блоки в гайд. Возвращает false, если вставить не удалось (например, не хватило места). */
  onInsert: (blocks: EditorBlock[]) => boolean;
};

const BLOCK_NOUNS = ["блок", "блока", "блоков"] as const;

function plural(count: number, forms: readonly [string, string, string]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

const blocksLabel = (count: number) => `${count} ${plural(count, BLOCK_NOUNS)}`;

/** Короткое описание раздела: сколько в нём блоков и есть ли картинки */
function sectionSummary(section: TemplateSection) {
  const body = section.blocks.filter((block) => block.type !== "heading");
  const media = body.filter((block) => block.type === "image" || block.type === "slider").length;
  return media > 0 ? `${blocksLabel(body.length)}, из них с картинками: ${media}` : blocksLabel(body.length);
}

const sectionTitle = (section: TemplateSection) =>
  section.title?.trim() ? section.title : "Без заголовка (вступление)";

function SectionPicker({
  sections,
  selected,
  onToggle,
}: {
  sections: TemplateSection[];
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  const id = useId();
  return (
    <ul className="flex flex-col gap-1">
      {sections.map((section) => (
        <li key={section.key}>
          <label
            htmlFor={`${id}-${section.key}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-primary/50"
          >
            <Checkbox
              id={`${id}-${section.key}`}
              checked={selected.has(section.key)}
              onCheckedChange={() => onToggle(section.key)}
              className="mt-0.5"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-sm">{sectionTitle(section)}</span>
              <span className="text-muted-foreground text-xs">{sectionSummary(section)}</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function BuiltInTab({ onPick }: { onPick: (blocks: EditorBlock[]) => void }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {guideTemplates.map((template) => {
        const count = template.create().length;
        return (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => onPick(template.create())}
              className="flex h-full w-full flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <span className="flex items-center gap-2 font-medium text-sm">
                <LayoutTemplate className="size-4 text-primary" aria-hidden="true" /> {template.label}
              </span>
              <span className="text-muted-foreground text-xs">{template.hint}</span>
              <span className="text-muted-foreground text-xs">{blocksLabel(count)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FromGuidesTab({ jobs, onPick }: { jobs: Job[]; onPick: (blocks: EditorBlock[]) => void }) {
  const [query, setQuery] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? jobs.filter((job) => job.title.toLowerCase().includes(needle)) : jobs;
  }, [jobs, query]);

  const job = jobs.find((item) => item.slug === slug) ?? null;
  const sections = useMemo(() => (job ? splitIntoSections(jobBlocks(job)) : []), [job]);

  const choose = (next: string) => {
    setSlug(next);
    setSelected(new Set());
  };

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const insert = (picked: TemplateSection[]) => {
    const blocks = picked.flatMap((section) => section.blocks);
    if (blocks.length === 0) return;
    onPick(toEditorBlocks(blocks));
  };

  return (
    <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти гайд"
            aria-label="Поиск гайда"
            autoComplete="off"
            className="pl-8"
          />
        </div>
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto md:max-h-80" aria-label="Гайды">
          {filtered.length === 0 && <li className="px-2 py-3 text-muted-foreground text-sm">Ничего не найдено</li>}
          {filtered.map((item) => (
            <li key={item.slug}>
              <button
                type="button"
                aria-pressed={item.slug === slug}
                onClick={() => choose(item.slug)}
                className="w-full truncate rounded-lg border border-transparent px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/50 aria-pressed:border-primary/50 aria-pressed:bg-primary/5"
              >
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {!job && (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
            Выберите гайд слева и отметьте разделы, которые нужно скопировать к себе.
          </p>
        )}
        {job && sections.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
            В этом гайде пока нет разделов.
          </p>
        )}
        {job && sections.length > 0 && (
          <>
            <div className="max-h-64 overflow-y-auto pr-1 md:max-h-72">
              <SectionPicker sections={sections} selected={selected} onToggle={toggle} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={selected.size === 0}
                onClick={() => insert(sections.filter((section) => selected.has(section.key)))}
              >
                Вставить выбранные ({selected.size})
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => insert(sections)}>
                Вставить весь гайд
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Тексты копируются, их можно менять. Картинки и слайды остаются теми же файлами.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function MineTab({ blocks, onPick }: { blocks: readonly EditorBlock[]; onPick: (blocks: EditorBlock[]) => void }) {
  const nameId = useId();
  const [templates, setTemplates] = useState<StoredTemplate[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  // Для сохранения берём то, что уже есть в гайде; пустые блоки и незагруженные картинки отбрасываются
  const sections = useMemo(() => splitIntoSections(toGuideBlocks(blocks)), [blocks]);
  const checked = selected ?? new Set(sections.map((section) => section.key));

  const toggle = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const save = () => {
    const title = name.trim();
    const picked: GuideBlock[] = sections
      .filter((section) => checked.has(section.key))
      .flatMap((section) => section.blocks);
    if (!title) {
      toast.error("Введите название шаблона");
      return;
    }
    if (picked.length === 0) {
      toast.error("Отметьте хотя бы один раздел");
      return;
    }
    const next = addTemplate(title, picked);
    if (!next) {
      toast.error("Не удалось сохранить: хранилище браузера недоступно или переполнено");
      return;
    }
    setTemplates(next);
    setName("");
    toast.success(`Шаблон «${title}» сохранён`);
  };

  const remove = (template: StoredTemplate) => {
    const next = removeTemplate(template.id);
    if (!next) {
      toast.error("Не удалось удалить шаблон");
      return;
    }
    setTemplates(next);
  };

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-2" aria-label="Сохранённые шаблоны">
        <h3 className="font-medium text-sm">Сохранённые</h3>
        {templates.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-muted-foreground text-sm">
            Пока пусто. Соберите шаблон из разделов текущего гайда справа.
          </p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center gap-2 rounded-xl border p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{template.name}</p>
                  <p className="text-muted-foreground text-xs">{blocksLabel(template.blocks.length)}</p>
                </div>
                <Button type="button" size="sm" onClick={() => onPick(toEditorBlocks(template.blocks))}>
                  Вставить
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Удалить шаблон «${template.name}»`}
                  onClick={() => remove(template)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground text-xs">
          Шаблоны хранятся в этом браузере: на другом устройстве их не будет. Максимум {MAX_STORED_TEMPLATES}.
        </p>
      </section>

      <section className="flex min-w-0 flex-col gap-3" aria-label="Сохранить текущий гайд как шаблон">
        <h3 className="font-medium text-sm">Сохранить из этого гайда</h3>
        {sections.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-muted-foreground text-sm">
            В гайде пока нечего сохранять: заполните хотя бы один блок.
          </p>
        ) : (
          <>
            <div className="max-h-48 overflow-y-auto pr-1">
              <SectionPicker sections={sections} selected={checked} onToggle={toggle} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={nameId}>Название шаблона</Label>
              <div className="flex gap-2">
                <Input
                  id={nameId}
                  value={name}
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      save();
                    }
                  }}
                  placeholder="Например, Раздел «Маршруты»"
                  autoComplete="off"
                />
                <Button type="button" variant="outline" onClick={save}>
                  Сохранить
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Окно выбора шаблона: готовые, разделы из других гайдов и свои сохранённые. */
export function GuideTemplatesDialog({ open, onOpenChange, blocks, otherJobs, onInsert }: GuideTemplatesDialogProps) {
  const pick = (picked: EditorBlock[]) => {
    if (picked.length === 0) return;
    if (onInsert(picked)) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Шаблоны</DialogTitle>
          <DialogDescription>
            Выбранные блоки добавятся в гайд там, где вы нажали «+», или в конец. После вставки их можно менять как
            обычно.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="builtin">
          <TabsList>
            <TabsTrigger value="builtin">Готовые</TabsTrigger>
            <TabsTrigger value="guides">Из гайдов</TabsTrigger>
            <TabsTrigger value="mine">Мои</TabsTrigger>
          </TabsList>
          <TabsContent value="builtin" className="pt-2">
            <BuiltInTab onPick={pick} />
          </TabsContent>
          <TabsContent value="guides" className="pt-2">
            <FromGuidesTab jobs={otherJobs} onPick={pick} />
          </TabsContent>
          <TabsContent value="mine" className="pt-2">
            <MineTab blocks={blocks} onPick={pick} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
