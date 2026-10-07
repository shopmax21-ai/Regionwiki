"use client";

import { useRef } from "react";

import { cn } from "cn";
import {
  ArrowDown,
  ArrowUp,
  Blocks,
  Copy,
  Heading2,
  ImagePlus,
  Images,
  Info,
  LayoutTemplate,
  Lightbulb,
  List,
  ListOrdered,
  LoaderCircle,
  MapPinned,
  PanelLeft,
  PanelRight,
  Plus,
  Trash2,
  TriangleAlert,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { calloutVariants, JOB_LIMITS } from "../_data/jobs";
import type { BlockKind, EditorBlock, EditorSlide } from "./editor-model";
import { RichTextarea } from "./format-toolbar";
import { MapBody } from "./guide-map-editor";
import { IMAGE_ACCEPT } from "./upload-image";

export type BlockActions = {
  update: (id: string, patch: Partial<EditorBlock>) => void;
  remove: (id: string) => void;
  move: (id: string, direction: -1 | 1) => void;
  duplicate: (id: string) => void;
  /** Вставить новый блок после блока afterId (null — в начало) */
  insert: (kind: BlockKind, afterId: string | null) => void;
  /** Открыть окно шаблонов: выбранное вставится после блока afterId (null — в начало) */
  openTemplates: (afterId: string | null) => void;
  /** Добавить картинки после блока targetId. Пустой блок с картинкой заполняется первым файлом, replace заменяет заполненный. */
  addFiles: (files: File[], targetId: string | null, options?: { replace?: boolean }) => void;
  /** Добавить файлы как новые слайды в конкретный слайдер. */
  addSliderFiles: (files: File[], sliderId: string) => void;
  updateSliderSlide: (sliderId: string, slideId: string, patch: Partial<EditorSlide>) => void;
  removeSliderSlide: (sliderId: string, slideId: string) => void;
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
  { kind: "slider", label: "Слайдер", hint: "Несколько изображений с переключением", icon: Images },
  { kind: "textImage", label: "Текст с картинкой", hint: "Объяснение и скриншот рядом", icon: PanelRight },
  { kind: "map", label: "Карта", hint: "Места на карте штата", icon: MapPinned },
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
    case "slider":
      return { label: "Слайдер", icon: Blocks };
    case "textImage":
      return { label: "Текст с картинкой", icon: PanelRight };
    case "map":
      return { label: "Карта", icon: MapPinned };
  }
};

export function AddBlockMenu({
  onAdd,
  onTemplates,
  children,
}: {
  onAdd: (kind: BlockKind) => void;
  onTemplates: () => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        className="max-h-[min(70svh,560px)] w-80 overflow-y-auto"
      >
        <DropdownMenuLabel className="flex items-center gap-2">
          <Blocks className="size-4" /> Добавить блок
        </DropdownMenuLabel>
        {kindMeta.map(({ kind, label, hint, icon: Icon }) => (
          <DropdownMenuItem key={kind} onSelect={() => onAdd(kind)} className="items-start gap-2.5 py-2.5">
            <Icon className="mt-0.5" />
            <span className="flex flex-col">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground text-xs">{hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onTemplates} className="items-start gap-2.5 py-2.5">
          <LayoutTemplate className="mt-0.5" />
          <span className="flex flex-col">
            <span className="font-medium">Шаблоны…</span>
            <span className="text-muted-foreground text-xs">Готовые, разделы из других гайдов и ваши</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Тонкая полоса между блоками: при наведении превращается в кнопку добавления. */
export function InsertSlot({ afterId, actions }: { afterId: string | null; actions: BlockActions }) {
  return (
    <div className="group/slot relative flex h-5 items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 h-px bg-border opacity-0 transition-opacity group-hover/slot:opacity-100 group-focus-within/slot:opacity-100" />
      <AddBlockMenu onAdd={(kind) => actions.insert(kind, afterId)} onTemplates={() => actions.openTemplates(afterId)}>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label="Добавить блок сюда"
          className="relative rounded-full bg-background opacity-0 transition-opacity group-hover/slot:opacity-100 group-focus-visible/slot:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
        >
          <Plus />
        </Button>
      </AddBlockMenu>
    </div>
  );
}

export function ImageBody({
  block,
  actions,
  compact,
}: {
  block: Extract<EditorBlock, { type: "image" | "textImage" }>;
  actions: BlockActions;
  /** Узкий вариант для картинки рядом с текстом: меньше превью, подпись и «Заменить» друг под другом */
  compact?: boolean;
}) {
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
          <img
            src={shown}
            alt=""
            className={cn("mx-auto object-contain", compact ? "max-h-52" : "max-h-80", block.uploading && "opacity-50")}
          />
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
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 text-center text-muted-foreground text-sm transition-colors hover:border-primary/60 hover:bg-muted/40 hover:text-foreground",
            compact ? "py-6" : "py-8",
          )}
        >
          <ImagePlus className="size-6" aria-hidden="true" />
          <span>{compact ? "Добавьте картинку" : "Перетащите картинку сюда или вставьте её через Ctrl+V"}</span>
          <span className="text-xs">
            {compact
              ? "Нажмите, перетащите файл или Ctrl+V"
              : "или нажмите, чтобы выбрать файл · PNG, JPEG, WebP, GIF до 5 МБ"}
          </span>
        </button>
      )}

      {block.error && (
        <p role="alert" className="text-destructive text-sm">
          {block.error}
        </p>
      )}

      {shown && (
        <div className={cn("flex flex-col gap-2", !compact && "sm:flex-row")}>
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
            className={cn("shrink-0 self-start", !compact && "sm:self-center")}
            onClick={() => input.current?.click()}
          >
            <ImagePlus data-icon="inline-start" /> Заменить
          </Button>
        </div>
      )}
    </div>
  );
}

/** Выбор стороны, на которой стоит картинка рядом с текстом. */
export function SideToggle({
  block,
  actions,
}: {
  block: Extract<EditorBlock, { type: "textImage" }>;
  actions: BlockActions;
}) {
  const options = [
    { side: "left", label: "Картинка слева", icon: PanelLeft },
    { side: "right", label: "Картинка справа", icon: PanelRight },
  ] as const;

  return (
    // biome-ignore lint/a11y/useSemanticElements: группа кнопок выбора, fieldset сломает вёрстку
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Сторона картинки">
      {options.map(({ side, label, icon: Icon }) => (
        <Button
          key={side}
          type="button"
          size="xs"
          variant={block.side === side ? "default" : "outline"}
          aria-pressed={block.side === side}
          onClick={() => actions.update(block.id, { side })}
        >
          <Icon data-icon="inline-start" /> {label}
        </Button>
      ))}
    </div>
  );
}

export function SliderBody({
  block,
  actions,
}: {
  block: Extract<EditorBlock, { type: "slider" }>;
  actions: BlockActions;
}) {
  const input = useRef<HTMLInputElement>(null);
  const hasSlides = block.slides.length > 0;

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
          if (files.length > 0) actions.addSliderFiles(files, block.id);
        }}
      />

      <div className="rounded-xl border bg-muted/20 p-2 sm:p-3" data-slider-preview={block.id}>
        {hasSlides ? (
          <Carousel opts={{ loop: block.slides.length > 1 }}>
            <CarouselContent>
              {block.slides.map((slide, index) => (
                <CarouselItem key={slide.id}>
                  <div className="relative overflow-hidden rounded-lg border bg-background">
                    {slide.src || slide.local ? (
                      // biome-ignore lint/performance/noImgElement: локальные адреса используются во время загрузки
                      <img
                        src={slide.src || slide.local}
                        alt={slide.caption || `Слайд ${index + 1}`}
                        className={cn("mx-auto max-h-64 object-contain", slide.uploading && "opacity-50")}
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                        Загрузите изображение
                      </div>
                    )}
                    {slide.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 text-sm">
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Загрузка…
                      </div>
                    )}
                    {block.slides.length > 1 && (
                      <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-1 text-xs shadow-sm">
                        {index + 1} / {block.slides.length}
                      </span>
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {block.slides.length > 1 && (
              <>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </>
            )}
          </Carousel>
        ) : (
          <div className="flex min-h-36 items-center justify-center text-center text-sm text-muted-foreground">
            Добавьте несколько изображений — они станут слайдами.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {block.slides.map((slide, index) => (
          <div
            key={slide.id}
            className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="size-14 overflow-hidden rounded-md border bg-muted/30">
              {slide.src || slide.local ? (
                // biome-ignore lint/performance/noImgElement: thumbnail uses uploaded/local image URL
                <img src={slide.src || slide.local} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{index + 1}</div>
              )}
            </div>
            <Input
              value={slide.caption}
              maxLength={JOB_LIMITS.caption}
              onChange={(event) => actions.updateSliderSlide(block.id, slide.id, { caption: event.target.value })}
              placeholder={`Подпись к слайду ${index + 1}`}
              aria-label={`Подпись к слайду ${index + 1}`}
              disabled={slide.uploading}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-destructive hover:text-destructive sm:justify-self-end"
              aria-label={`Удалить слайд ${index + 1}`}
              onClick={() => actions.removeSliderSlide(block.id, slide.id)}
            >
              <Trash2 />
            </Button>
            {slide.error && (
              <p role="alert" className="sm:col-span-3 text-destructive text-xs">
                {slide.error}
              </p>
            )}
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
        <ImagePlus data-icon="inline-start" /> Добавить изображения
      </Button>
      <p className="text-muted-foreground text-xs">
        До {JOB_LIMITS.sliderSlides} слайдов. Подписи можно редактировать прямо в карточках слайдов.
      </p>
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
          placeholder="Текст блока. Можно редактировать прямо здесь. Для жирного используйте **две звёздочки**."
          aria-label="Текст блока"
          className="min-h-24"
        />
      );

    case "list":
      return (
        <div className="flex flex-col gap-1.5">
          <Textarea
            value={block.text}
            maxLength={JOB_LIMITS.blockText}
            onChange={(event) => actions.update(block.id, { text: event.target.value })}
            placeholder={block.ordered ? "Шаги по порядку, каждый с новой строки" : "Пункты, каждый с новой строки"}
            aria-label={block.ordered ? "Шаги" : "Пункты списка"}
            className="min-h-24"
          />
          <p className="text-muted-foreground text-xs">
            Каждая строка — отдельный пункт. {block.ordered ? "Номера появятся сами." : ""}
          </p>
        </div>
      );

    case "callout":
      return (
        <div className="flex flex-col gap-2">
          {/* biome-ignore lint/a11y/useSemanticElements: группа кнопок выбора, fieldset сломает вёрстку */}
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
            placeholder="Текст выделенного блока — редактируется прямо внутри карточки"
            aria-label="Текст выделенного блока"
            className="min-h-20"
          />
        </div>
      );

    case "image":
      return <ImageBody block={block} actions={actions} />;

    case "slider":
      return <SliderBody block={block} actions={actions} />;

    case "textImage":
      return (
        <div className="flex flex-col gap-3">
          <SideToggle block={block} actions={actions} />
          <ImageBody block={block} actions={actions} compact />
          <RichTextarea
            blockTools
            value={block.text}
            maxLength={JOB_LIMITS.blockText}
            onValueChange={(text) => actions.update(block.id, { text })}
            placeholder="Объяснение рядом с картинкой"
            aria-label="Текст рядом с картинкой"
            className="min-h-24"
          />
        </div>
      );

    case "map":
      return <MapBody block={block} actions={actions} />;
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
  const busy = (block.type === "image" || block.type === "textImage") && block.uploading;
  const sliderBusy = block.type === "slider" && block.slides.some((slide) => slide.uploading);

  return (
    <div
      data-block-id={block.id}
      data-slider-preview={block.type === "slider" ? block.id : undefined}
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
            disabled={busy || sliderBusy}
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

/** Плавающая кнопка добавления блока справа снизу: общая для режимов «Карточки» и «На странице». */
export function FloatingAddBlock({ blocks, actions }: { blocks: readonly EditorBlock[]; actions: BlockActions }) {
  const atLimit = blocks.length >= JOB_LIMITS.blocks;
  const endId = blocks.at(-1)?.id ?? null;

  return (
    <div className="fixed right-5 bottom-24 z-40 sm:right-7 sm:bottom-28">
      <AddBlockMenu onAdd={(kind) => actions.insert(kind, endId)} onTemplates={() => actions.openTemplates(endId)}>
        <Button type="button" size="lg" disabled={atLimit} className="h-12 rounded-full px-5 shadow-lg shadow-black/10">
          <Plus data-icon="inline-start" /> Добавить блок
        </Button>
      </AddBlockMenu>
    </div>
  );
}

/** Список блоков гайда. Основное меню добавления закреплено справа снизу, а между блоками остаются тонкие слоты. */
export function JobBlockEditor({ blocks, actions }: { blocks: EditorBlock[]; actions: BlockActions }) {
  const atLimit = blocks.length >= JOB_LIMITS.blocks;

  return (
    <div className="flex flex-col">
      {blocks.length === 0 && (
        <div className="mb-3 rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          В гайде пока нет блоков. Используйте плавающую кнопку справа снизу, чтобы добавить блок или готовый шаблон.
        </div>
      )}

      {blocks.map((block, index) => (
        <div key={block.id}>
          {index > 0 && <InsertSlot afterId={blocks[index - 1].id} actions={actions} />}
          <BlockCard block={block} index={index} count={blocks.length} actions={actions} />
        </div>
      ))}

      <div className="mt-4 text-xs text-muted-foreground">
        Контент каждого блока редактируется непосредственно внутри его карточки. Для точной вставки между блоками
        используйте «+» на границе.
        {atLimit && <span className="ml-1">Достигнут предел: {JOB_LIMITS.blocks} блоков.</span>}
      </div>

      <FloatingAddBlock blocks={blocks} actions={actions} />
    </div>
  );
}
