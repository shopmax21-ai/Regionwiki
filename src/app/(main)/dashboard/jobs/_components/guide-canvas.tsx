"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "cn";
import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { type CalloutVariant, calloutVariants, JOB_LIMITS } from "../_data/jobs";
import type { EditorBlock } from "./editor-model";
import { calloutStyle, InlineText, RichBlocks } from "./guide-blocks";
import { MapBody } from "./guide-map-editor";
import { FormatToolbar, handleFormatShortcut } from "./format-toolbar";
import { type BlockActions, FloatingAddBlock, ImageBody, InsertSlot, SideToggle, SliderBody } from "./job-block-editor";

type InlineFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  maxLength?: number;
  /** Показывать **жирный** как на странице, пока поле не редактируется */
  rich?: boolean;
  /** Показывать нумерацию, списки и подзаголовки как на странице, а в панели форматирования — кнопки списков и маршрута */
  blocks?: boolean;
  /** Одна строка: Enter завершает правку (или вызывает onEnter) */
  singleLine?: boolean;
  /** Новое значение переводит поле в режим правки: так фокус переходит между пунктами списка */
  focusToken?: number;
  className?: string;
  onEnter?: () => void;
  onBackspaceEmpty?: () => void;
};

/**
 * Текст, который правится прямо на странице. В покое выглядит как опубликованный текст,
 * по клику или Tab превращается в поле ввода с теми же шрифтом и отступами.
 */
function InlineField({
  value,
  onChange,
  placeholder,
  label,
  maxLength,
  rich,
  blocks,
  singleLine,
  focusToken = 0,
  className,
  onEnter,
  onBackspaceEmpty,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(focusToken > 0);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusToken > 0) setEditing(true);
  }, [focusToken]);

  // Поле растёт вместе с текстом, поэтому страница не прыгает при переходе между режимами
  // biome-ignore lint/correctness/useExhaustiveDependencies: высоту нужно пересчитывать при каждом изменении значения
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value, editing]);

  useLayoutEffect(() => {
    const element = area.current;
    if (!editing || !element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, [editing]);

  let shown: React.ReactNode = value;
  if (!value) shown = placeholder;
  else if (blocks) shown = <RichBlocks text={value} />;
  else if (rich) shown = <InlineText text={value} />;

  if (!editing) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: внутри может быть разметка, кнопка здесь не подходит
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label}: изменить`}
        onClick={() => setEditing(true)}
        onFocus={() => setEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setEditing(true);
          }
        }}
        className={cn(
          "min-h-[1.5em] cursor-text rounded-sm outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/40",
          !value && "text-muted-foreground italic",
          className,
        )}
      >
        {shown}
      </div>
    );
  }

  return (
    <div className="relative">
      {rich && (
        <FormatToolbar
          getTextarea={() => area.current}
          onChange={onChange}
          blockTools={blocks}
          className="absolute -top-9 left-0 z-30"
        />
      )}
      <textarea
        ref={area}
        value={value}
        rows={1}
        maxLength={maxLength}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => onChange(singleLine ? event.target.value.replace(/\n/g, " ") : event.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => {
          if (rich && handleFormatShortcut(event, onChange)) return;
          if (event.key === "Escape") {
            event.currentTarget.blur();
          } else if (event.key === "Enter" && !event.shiftKey && (singleLine || onEnter)) {
            event.preventDefault();
            if (onEnter) onEnter();
            else event.currentTarget.blur();
          } else if (event.key === "Backspace" && value === "" && onBackspaceEmpty) {
            event.preventDefault();
            onBackspaceEmpty();
          }
        }}
        className={cn(
          "m-0 block w-full resize-none overflow-hidden rounded-sm border-0 bg-primary/5 p-0 text-inherit outline-none ring-2 ring-primary/40 placeholder:text-muted-foreground",
          className,
        )}
      />
    </div>
  );
}

type ListBlock = Extract<EditorBlock, { type: "list" }>;

/** Список: каждый пункт правится отдельно. Enter добавляет пункт, Backspace в пустом удаляет его. */
function ListEditor({ block, actions }: { block: ListBlock; actions: BlockActions }) {
  const items = block.text === "" ? [""] : block.text.split("\n");
  const [focus, setFocus] = useState<{ index: number; token: number }>({ index: -1, token: 0 });
  const focusOn = (index: number) => setFocus((prev) => ({ index, token: prev.token + 1 }));

  const commit = (next: string[]) => actions.update(block.id, { text: next.join("\n") });

  const change = (index: number, value: string) => {
    // Вставка нескольких строк сразу разбивается на пункты
    const next = [...items];
    next.splice(index, 1, ...value.split("\n"));
    commit(next);
  };

  const addAfter = (index: number) => {
    if (items.length >= JOB_LIMITS.listItems) return;
    const next = [...items];
    next.splice(index + 1, 0, "");
    focusOn(index + 1);
    commit(next);
  };

  const removeAt = (index: number) => {
    if (items.length === 1) return;
    focusOn(Math.max(0, index - 1));
    commit(items.filter((_, i) => i !== index));
  };

  const field = (item: string, index: number) => (
    <InlineField
      key={`field-${index}`}
      value={item}
      rich
      singleLine
      focusToken={focus.index === index ? focus.token : 0}
      label={block.ordered ? `Шаг ${index + 1}` : `Пункт ${index + 1}`}
      placeholder={block.ordered ? "Опишите шаг" : "Опишите пункт"}
      maxLength={JOB_LIMITS.item}
      onChange={(value) => change(index, value)}
      onEnter={() => addAfter(index)}
      onBackspaceEmpty={() => removeAt(index)}
    />
  );

  return block.ordered ? (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: пункты не имеют собственных id
        <li key={index} className="flex items-start gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary text-xs">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 pt-0.5">{field(item, index)}</span>
        </li>
      ))}
    </ol>
  ) : (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: пункты не имеют собственных id
        <li key={index}>{field(item, index)}</li>
      ))}
    </ul>
  );
}

const variantOrder: CalloutVariant[] = ["tip", "info", "warning"];

function CalloutEditor({
  block,
  actions,
}: {
  block: Extract<EditorBlock, { type: "callout" }>;
  actions: BlockActions;
}) {
  const { box, icon, Icon } = calloutStyle[block.variant];
  const next = variantOrder[(variantOrder.indexOf(block.variant) + 1) % variantOrder.length];

  return (
    <div className={cn("flex items-start gap-2 rounded-lg border-l-2 px-3 py-2", box)}>
      <button
        type="button"
        title={`Вид: ${calloutVariants[block.variant]}. Нажмите, чтобы сменить на «${calloutVariants[next]}»`}
        aria-label={`Вид выделения: ${calloutVariants[block.variant]}. Сменить на «${calloutVariants[next]}»`}
        onClick={() => actions.update(block.id, { variant: next })}
        className="mt-0.5 shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Icon className={cn("size-4", icon)} aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <InlineField
          rich
          value={block.text}
          label={calloutVariants[block.variant]}
          placeholder={`${calloutVariants[block.variant]}: введите текст`}
          maxLength={JOB_LIMITS.blockText}
          className="whitespace-pre-line"
          onChange={(text) => actions.update(block.id, { text })}
        />
      </div>
    </div>
  );
}

const blockLabel = (block: EditorBlock) => {
  switch (block.type) {
    case "heading":
      return "заголовок";
    case "text":
      return "текст";
    case "list":
      return block.ordered ? "шаги" : "список";
    case "callout":
      return calloutVariants[block.variant].toLowerCase();
    case "image":
      return "картинка";
    case "slider":
      return "слайдер";
    case "textImage":
      return "текст с картинкой";
    case "map":
      return "карта";
  }
};

/** Рамка блока: при наведении или фокусе показывает панель «выше / ниже / копия / удалить». */
function BlockChrome({
  block,
  index,
  count,
  actions,
  children,
}: {
  block: EditorBlock;
  index: number;
  count: number;
  actions: BlockActions;
  children: React.ReactNode;
}) {
  const label = blockLabel(block);
  const busy =
    ((block.type === "image" || block.type === "textImage") && block.uploading) ||
    (block.type === "slider" && block.slides.some((slide) => slide.uploading));

  return (
    <div
      data-block-id={block.id}
      className="group/block relative rounded-lg outline-1 outline-transparent outline-dashed transition-[outline-color] hover:outline-primary/30 focus-within:outline-primary/40"
    >
      <div className="absolute -top-3.5 right-1 z-10 hidden items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-sm group-focus-within/block:flex group-hover/block:flex">
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
      {children}
    </div>
  );
}

function BlockContent({ block, actions }: { block: EditorBlock; actions: BlockActions }) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="font-semibold text-xl tracking-tight">
          <InlineField
            singleLine
            value={block.text}
            label="Заголовок раздела"
            placeholder="Заголовок раздела"
            maxLength={JOB_LIMITS.sectionTitle}
            onChange={(text) => actions.update(block.id, { text })}
          />
        </h2>
      );

    case "text":
      return (
        <InlineField
          rich
          value={block.text}
          label="Текст"
          placeholder="Введите текст. **Двойные звёздочки** делают его жирным."
          maxLength={JOB_LIMITS.blockText}
          className="whitespace-pre-line"
          onChange={(text) => actions.update(block.id, { text })}
        />
      );

    case "list":
      return <ListEditor block={block} actions={actions} />;

    case "callout":
      return <CalloutEditor block={block} actions={actions} />;

    case "image":
      return <ImageBody block={block} actions={actions} />;

    case "slider":
      return <SliderBody block={block} actions={actions} />;

    case "map":
      return <MapBody block={block} actions={actions} />;

    case "textImage":
      return (
        <div className="flex flex-col gap-3">
          <SideToggle block={block} actions={actions} />
          <div
            className={cn(
              "flex flex-col gap-4 sm:items-start",
              block.side === "left" ? "sm:flex-row" : "sm:flex-row-reverse",
            )}
          >
            <div className="w-full shrink-0 sm:w-[38%] sm:max-w-sm">
              <ImageBody block={block} actions={actions} compact />
            </div>
            <div className="min-w-0 flex-1">
              <InlineField
                rich
                blocks
                value={block.text}
                label="Текст рядом с картинкой"
                placeholder="Объяснение рядом с картинкой. Нажмите, чтобы написать."
                maxLength={JOB_LIMITS.blockText}
                className="whitespace-pre-line"
                onChange={(text) => actions.update(block.id, { text })}
              />
            </div>
          </div>
        </div>
      );
  }
}

type CanvasSection = { key: string; heading: Extract<EditorBlock, { type: "heading" }> | null; items: EditorBlock[] };

/**
 * Режим «На странице»: гайд выглядит так же, как у посетителей (заголовки снаружи, содержимое в карточках),
 * а текст, списки и заметки правятся прямо на месте. Картинки и слайдеры загружаются и подписываются тут же.
 */
export function GuideCanvas({ blocks, actions }: { blocks: EditorBlock[]; actions: BlockActions }) {
  const indexOf = useMemo(() => new Map(blocks.map((block, index) => [block.id, index] as const)), [blocks]);

  const sections = useMemo(() => {
    const result: CanvasSection[] = [];
    for (const block of blocks) {
      if (block.type === "heading") {
        result.push({ key: block.id, heading: block, items: [] });
        continue;
      }
      let current = result.at(-1);
      if (!current) {
        current = { key: "intro", heading: null, items: [] };
        result.push(current);
      }
      current.items.push(block);
    }
    return result;
  }, [blocks]);

  const chrome = (block: EditorBlock, children: React.ReactNode) => (
    <BlockChrome block={block} index={indexOf.get(block.id) ?? 0} count={blocks.length} actions={actions}>
      {children}
    </BlockChrome>
  );

  return (
    <div className="flex flex-col gap-3">
      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          В гайде пока нет блоков. Нажмите «Добавить блок» справа снизу: можно начать с заголовка или взять шаблон.
        </div>
      ) : (
        <div className="flex flex-col rounded-2xl border bg-muted/20 p-3 sm:p-5">
          {sections.map((section, sectionIndex) => {
            const previous = sections[sectionIndex - 1];
            const previousLastId = previous ? (previous.items.at(-1)?.id ?? previous.heading?.id ?? null) : null;

            return (
              <section key={section.key} className="flex flex-col gap-3 py-1">
                {previous && <InsertSlot afterId={previousLastId} actions={actions} />}
                {section.heading && chrome(section.heading, <BlockContent block={section.heading} actions={actions} />)}

                <div className="flex min-w-0 flex-col break-words rounded-xl border bg-card p-4 text-sm leading-6 shadow-xs md:p-5">
                  {section.items.length === 0 ? (
                    <p className="text-muted-foreground">
                      Раздел пока пуст. Наведите на границу и нажмите «+», чтобы добавить блок сюда.
                    </p>
                  ) : (
                    section.items.map((block, index) => (
                      <Fragment key={block.id}>
                        {index > 0 && <InsertSlot afterId={section.items[index - 1].id} actions={actions} />}
                        {chrome(block, <BlockContent block={block} actions={actions} />)}
                      </Fragment>
                    ))
                  )}
                  {section.heading && section.items.length === 0 && (
                    <InsertSlot afterId={section.heading.id} actions={actions} />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Нажмите на текст, чтобы изменить его. Esc завершает правку. В списках Enter добавляет пункт. Значок слева в
        заметке меняет её вид.
      </p>

      <FloatingAddBlock blocks={blocks} actions={actions} />
    </div>
  );
}
