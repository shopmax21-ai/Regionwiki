"use client";

import { useRef } from "react";

import { cn } from "cn";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Heading2,
  ImagePlus,
  Info,
  LoaderCircle,
  Lightbulb,
  List,
  ListOrdered,
  Plus,
  TriangleAlert,
  Trash2,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { calloutVariants, JOB_LIMITS } from "../_data/jobs";
import { type BlockKind, type EditorBlock } from "./editor-model";
import { IMAGE_ACCEPT } from "./upload-image";

export type BlockActions = {
  update: (id: string, patch: Partial<EditorBlock>) => void;
  remove: (id: string) => void;
  move: (id: string, direction: -1 | 1) => void;
  duplicate: (id: string) => void;
  /** Вставить новый блок после блока afterId (null — в начало) */
  insert: (kind: BlockKind, afterId: string | null) => void;
  /** Добавить картинки после блока targetId. Пустой блок с картинкой заполняется первым файлом, replace заменяет и заполненный. */
  addFiles: (files: File[], targetId: string | null, options?: { replace?: boolean }) => void;
};

const kindMeta: { kind: BlockKind; label: string; hint: string; icon: typeof Type }[] = [
  { kind: "heading", label: "Заголовок", hint: "Новый раздел в содержании", icon: Heading2 },
  { kind: "text", label: "Текст", hint: "Абзац", icon: Type },
  { kind: "bullets", label: "Список", hint: "Пункты с маркерами", icon: List },
  { kind: "steps", label: "Шаги", hint: "Нумерованный порядок действий", icon: ListOrdered },
  { kind: "tip", label: "Совет", hint: "Выделенная подсказка", icon: Lightbulb },
  { kind: "warning", label: "Важно", hint: "Предупреждение", icon: TriangleAlert },
  { kind: "info", label: "Заметка", hint: "Справка или уточнение", icon: Info },
  { kind: "image", label: "Картинка", hint: "Перетащите файл или нажмите Ctrl+V", icon: ImagePlus },
];

const typeLabel = (block: EditorBlock) => {
  switch (block.type) {
    case "heading":
      return { label: "Заголовок", icon: Heading2 };
    case "text":
      return { label: "Текст", icon: Type };
    case "list":
      return block.ordered ? { label: "Шаги", icon: ListOrdered } : { label: "Список", icon: List };
    case "callout":
      return {
        label: calloutVariants[block.variant],
        icon: block.variant === "tip" ? Lightbulb : block.variant === "warning" ? TriangleAlert : Info,
      };
    case "image":
      return { label: "Картинка", icon: ImagePlus };
  }
};

function AddBlockMenu({
  onAdd,
  children,
}: {
  onAdd: (kind: BlockKind) => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64">
        {kindMeta.map(({ kind, label, hint, icon: Icon }) => (
          <DropdownMenuItem key={kind} onSelect={() => onAdd(kind)} className="items-start gap-2.5">
            <Icon className="mt-0.5" />
            <span className="flex flex-col">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground text-xs">{hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Тонкая полоса между блоками: при наведении превращается в кнопку «Добавить блок сюда». */
function InsertSlot({ afterId, actions }: { afterId: string | null; actions: BlockActions }) {
  return (
    <div className="group/slot relative flex h-5 items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 h-px bg-border opacity-0 transition-opacity group-focus-within/slot:opacity-100 group-hover/slot:opacity-100" />
      <AddBlockMenu onAdd={(kind) => actions.insert(kind, afterId)}>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label="Добавить блок сюда"
          className="relative rounded-full bg-background opacity-0 transition-opacity focus-visible:opacity-100 group-hover/slot:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
        >
          <Plus />
        </Button>
      </AddBlockMenu>
    </div>
  );
}

function ImageBody({ block, actions }: { block: Extract<EditorBlock, { type: "image" }>; actions: BlockActions }) {
  const input = useRef<HTMLInputElement>(null);
  const shown = block.src || block.local;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) actions.addFiles(files, block.id, { replace: true });
        }}
      />

      {shown ? (
        <div className="relative overflow-hidden rounded-lg border bg-muted/30">
          {/* biome-ignore lint/performance/noImgElement: размеры загружаемой картинки заранее неизвестны */}
          <img src={shown} alt="" className={cn("mx-auto max-h-80 object-contain", block.uploading && "opacity-50")} />
          {block.uploading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Загрузка…
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm transition-colors hover:border-primary/60 hover:bg-muted/40 hover:text-foreground"
        >
          <ImagePlus className="size-6" aria-hidden="true" />
          <span>Перетащите картинку сюда или вставьте её через Ctrl+V</span>
          <span className="text-xs">или нажмите, чтобы выбрать файл · PNG, JPEG, WebP, GIF до 5 МБ</span>
        </button>
      )}

      {block.error && (
        <p role="alert" className="text-destructive text-sm">
          {block.error}
        </p>
      )}

      {shown && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={block.caption}
            maxLength={JOB_LIMITS.caption}
            onChange={(event) => actions.update(block.id, { caption: event.target.value })}
            placeholder="Подпись к картинке (необязательно)"
            aria-label="Подпись к картинке"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={block.uploading}
            className="shrink-0 self-start sm:self-center"
            onClick={() => input.current?.click()}
          >
            <ImagePlus data-icon="inline-start" /> Заменить
          </Button>
        </div>
      )}
    </div>
  );
}

function BlockBody({ block, actions }: { block: EditorBlock; actions: BlockActions }) {
  switch (block.type) {
    case "heading":
      return (
        <Input
          value={block.text}
          maxLength={JOB_LIMITS.sectionTitle}
          onChange={(event) => actions.update(block.id, { text: event.target.value })}
          placeholder="Заголовок раздела, например «Маршруты»"
          aria-label="Заголовок раздела"
          autoComplete="off"
          className="font-semibold"
        />
      );

    case "text":
      return (
        <Textarea
          value={block.text}
          maxLength={JOB_LIMITS.blockText}
          onChange={(event) => actions.update(block.id, { text: event.target.value })}
          placeholder="Текст. Чтобы выделить слово, оберните его в **две звёздочки**"
          aria-label="Текст"
          className="min-h-20"
        />
      );

    case "list":
      return (
        <div className="flex flex-col gap-1.5">
          <Textarea
            value={block.text}
            onChange={(event) => actions.update(block.id, { text: event.target.value })}
            placeholder={block.ordered ? "Шаги по порядку, каждый с новой строки" : "Пункты, каждый с новой строки"}
            aria-label={block.ordered ? "Шаги" : "Пункты списка"}
            className="min-h-20"
          />
          <p className="text-muted-foreground text-xs">
            Каждая строка — отдельный пункт.
            {block.ordered ? " Номера появятся сами." : ""}
          </p>
        </div>
      );

    case "callout":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Вид выделения">
            {(Object.keys(calloutVariants) as (keyof typeof calloutVariants)[]).map((variant) => (
              <Button
                key={variant}
                type="button"
                size="xs"
                variant={block.variant === variant ? "default" : "outline"}
                aria-pressed={block.variant === variant}
                onClick={() => actions.update(block.id, { variant })}
              >
                {calloutVariants[variant]}
              </Button>
            ))}
          </div>
          <Textarea
            value={block.text}
            maxLength={JOB_LIMITS.blockText}
            onChange={(event) => actions.update(block.id, { text: event.target.value })}
            placeholder="Текст подсказки"
            aria-label="Текст выделенного блока"
            className="min-h-16"
          />
        </div>
      );

    case "image":
      return <ImageBody block={block} actions={actions} />;
  }
}

function BlockCard({
  block,
  index,
  count,
  actions,
}: {
  block: EditorBlock;
  index: number;
  count: number;
  actions: BlockActions;
}) {
  const { label, icon: Icon } = typeLabel(block);
  const busy = block.type === "image" && block.uploading;

  return (
    <div
      data-block-id={block.id}
      tabIndex={-1}
      className="rounded-xl border bg-card p-3 shadow-xs outline-none transition-shadow focus-within:ring-2 focus-within:ring-primary/30 focus:ring-2 focus:ring-primary/30"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          <Icon className="size-3.5" aria-hidden="true" /> {label}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Поднять блок «${label}» выше`}
            disabled={index === 0}
            onClick={() => actions.move(block.id, -1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Опустить блок «${label}» ниже`}
            disabled={index === count - 1}
            onClick={() => actions.move(block.id, 1)}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Дублировать блок «${label}»`}
            disabled={busy}
            onClick={() => actions.duplicate(block.id)}
          >
            <Copy />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Удалить блок «${label}»`}
            className="text-destructive hover:text-destructive"
            onClick={() => actions.remove(block.id)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <BlockBody block={block} actions={actions} />
    </div>
  );
}

/** Список блоков гайда с кнопками добавления. Сама вставка и загрузка картинок живёт в родителе. */
export function JobBlockEditor({ blocks, actions }: { blocks: EditorBlock[]; actions: BlockActions }) {
  const atLimit = blocks.length >= JOB_LIMITS.blocks;

  return (
    <div className="flex flex-col">
      {blocks.length === 0 && (
        <div className="mb-3 rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          В гайде пока нет блоков. Добавьте заголовок, текст или список, а картинку можно просто перетащить в окно или
          вставить через Ctrl+V.
        </div>
      )}

      {blocks.map((block, index) => (
        <div key={block.id}>
          {index > 0 && <InsertSlot afterId={blocks[index - 1].id} actions={actions} />}
          <BlockCard block={block} index={index} count={blocks.length} actions={actions} />
        </div>
      ))}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {kindMeta.map(({ kind, label, icon: Icon }) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            disabled={atLimit}
            onClick={() => actions.insert(kind, blocks.at(-1)?.id ?? null)}
          >
            <Icon data-icon="inline-start" /> {label}
          </Button>
        ))}
      </div>
      {atLimit && (
        <p className="mt-2 text-muted-foreground text-xs">Достигнут предел: {JOB_LIMITS.blocks} блоков в одном гайде.</p>
      )}
    </div>
  );
}
