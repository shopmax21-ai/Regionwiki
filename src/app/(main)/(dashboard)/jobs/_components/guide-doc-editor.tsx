"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "cn";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Heading2,
  ImagePlus,
  Images,
  Info,
  Keyboard,
  Lightbulb,
  List,
  ListOrdered,
  type LucideIcon,
  MapPinned,
  PanelRight,
  Plus,
  Route,
  Trash2,
  TriangleAlert,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { type CalloutVariant, calloutVariants, JOB_LIMITS } from "../_data/jobs";
import type { BlockKind, EditorBlock } from "./editor-model";
import { FormatToolbar, handleFormatShortcut } from "./format-toolbar";
import { calloutStyle, InlineText, RichBlocks } from "./guide-blocks";
import { MapBody } from "./guide-map-editor";
import { AddBlockMenu, type BlockActions, ImageBody, SideToggle, SliderBody } from "./job-block-editor";

/* ------------------------------------------------------------------ */
/* Меню «/»                                                             */
/* ------------------------------------------------------------------ */

/** Пункты меню «/»: вид блока или готовая вставка в текст (маршрут, клавиша) */
type SlashKind = BlockKind | "route" | "key";
type SlashItem = { kind: SlashKind; label: string; hint: string; icon: LucideIcon; keywords: string };

const SLASH_ITEMS: readonly SlashItem[] = [
  { kind: "text", label: "Текст", hint: "Обычный абзац", icon: Type, keywords: "text абзац параграф" },
  { kind: "heading", label: "Заголовок", hint: "Раздел в содержании", icon: Heading2, keywords: "heading h2 раздел" },
  { kind: "bullets", label: "Список", hint: "Пункты с маркерами", icon: List, keywords: "list bullets маркеры" },
  { kind: "steps", label: "Шаги", hint: "Нумерованный порядок", icon: ListOrdered, keywords: "steps номера порядок" },
  { kind: "tip", label: "Совет", hint: "Подсказка новичкам", icon: Lightbulb, keywords: "tip подсказка" },
  { kind: "info", label: "Заметка", hint: "Справка или уточнение", icon: Info, keywords: "info справка" },
  { kind: "warning", label: "Важно", hint: "Предупреждение", icon: TriangleAlert, keywords: "warning внимание" },
  {
    kind: "image",
    label: "Картинка",
    hint: "Файл, перетаскивание или Ctrl+V",
    icon: ImagePlus,
    keywords: "image фото",
  },
  { kind: "slider", label: "Слайдер", hint: "Несколько картинок", icon: Images, keywords: "slider галерея" },
  {
    kind: "textImage",
    label: "Текст с картинкой",
    hint: "Объяснение рядом со скриншотом",
    icon: PanelRight,
    keywords: "",
  },
  { kind: "map", label: "Карта", hint: "Места на карте штата", icon: MapPinned, keywords: "map места" },
  {
    kind: "route",
    label: "Маршрут по меню",
    hint: "Телефон > Whoosh > Арендовать",
    icon: Route,
    keywords: "route маршрут путь меню стрелка",
  },
  { kind: "key", label: "Клавиша", hint: "F10 или Ctrl+C", icon: Keyboard, keywords: "key клавиша кнопка сочетание" },
];

const matches = (item: SlashItem, query: string) =>
  query === "" || `${item.label} ${item.keywords}`.toLowerCase().includes(query);

function SlashMenu({
  items,
  active,
  onPick,
  onHover,
}: {
  items: readonly SlashItem[];
  active: number;
  onPick: (item: SlashItem) => void;
  onHover: (index: number) => void;
}) {
  return (
    <div
      role="listbox"
      aria-label="Тип блока"
      // Клик по пункту не должен забирать фокус у поля, иначе меню закроется раньше, чем сработает выбор
      onMouseDown={(event) => event.preventDefault()}
      className="absolute top-full left-0 z-40 mt-1 flex max-h-72 w-72 max-w-full flex-col overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {items.map((item, index) => (
        <button
          key={item.kind}
          type="button"
          role="option"
          aria-selected={index === active}
          onMouseEnter={() => onHover(index)}
          onClick={() => onPick(item)}
          className={cn(
            "flex items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none",
            index === active && "bg-accent text-accent-foreground",
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
            <item.icon className="size-4" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-medium text-sm">{item.label}</span>
            <span className="truncate text-muted-foreground text-xs">{item.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Поле: выглядит как опубликованный текст, правится по клику           */
/* ------------------------------------------------------------------ */

/** Находит поле в блоке и ставит в него курсор. Работает и для текста в покое, и для открытого поля. */
export function focusField(blockId: string) {
  const field = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"] [data-doc-field]`);
  field?.focus();
}

type DocFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
  maxLength?: number;
  /** Одна строка: Enter не вставляет перенос */
  singleLine?: boolean;
  /** Панель форматирования над выделением и отображение **жирного** вне правки */
  rich?: boolean;
  /** Показывать нумерацию и подзаголовки внутри текста, как на странице */
  blocks?: boolean;
  /** Новое значение переводит поле в режим правки: так курсор переходит между пунктами списка */
  focusToken?: number;
  onEnter?: () => void;
  onBackspaceEmpty?: () => void;
  onEditingChange?: (editing: boolean) => void;
  /** Перехват клавиш до обычной обработки: true — клавиша обработана */
  onKeyDownIntercept?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  children?: React.ReactNode;
};

export function DocField({
  value,
  onChange,
  placeholder,
  label,
  className,
  maxLength,
  singleLine,
  rich,
  blocks,
  focusToken = 0,
  onEnter,
  onBackspaceEmpty,
  onEditingChange,
  onKeyDownIntercept,
  children,
}: DocFieldProps) {
  const [editing, setEditingState] = useState(focusToken > 0);
  const [selected, setSelected] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  /** Касание панели на телефоне уводит фокус из поля: без отметки поле закрылось бы раньше, чем сработает кнопка */
  const toolbarTouched = useRef(false);

  const setEditing = (next: boolean) => {
    setEditingState(next);
    onEditingChange?.(next);
    if (!next) setSelected(false);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: реагируем только на новое значение токена
  useEffect(() => {
    if (focusToken > 0) setEditing(true);
  }, [focusToken]);

  // Поле растёт вместе с текстом: страница не прыгает при переходе между правкой и просмотром
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

  if (!editing) {
    let shown: React.ReactNode = placeholder;
    if (value) {
      if (blocks) shown = <RichBlocks text={value} />;
      else if (rich) shown = <InlineText text={value} />;
      else shown = value;
    }

    return (
      // biome-ignore lint/a11y/useSemanticElements: внутри может быть разметка, кнопка здесь не подходит
      <div
        role="button"
        tabIndex={0}
        data-doc-field
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
          "min-h-[1.5em] cursor-text whitespace-pre-line rounded-sm outline-none",
          !value && "text-muted-foreground/60",
          className,
        )}
      >
        {shown}
      </div>
    );
  }

  return (
    <div className="relative">
      {rich && selected && (
        <div
          className="absolute -top-10 left-0 z-30 max-w-full"
          onPointerDownCapture={() => {
            toolbarTouched.current = true;
            setTimeout(() => {
              toolbarTouched.current = false;
            }, 400);
          }}
        >
          <FormatToolbar getTextarea={() => area.current} onChange={onChange} blockTools={blocks} insertTools />
        </div>
      )}
      <textarea
        ref={area}
        data-doc-field
        value={value}
        rows={1}
        maxLength={maxLength}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => onChange(singleLine ? event.target.value.replace(/\n/g, " ") : event.target.value)}
        onSelect={(event) => setSelected(event.currentTarget.selectionStart !== event.currentTarget.selectionEnd)}
        onBlur={() => {
          if (toolbarTouched.current) {
            toolbarTouched.current = false;
            requestAnimationFrame(() => area.current?.focus());
            return;
          }
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (onKeyDownIntercept?.(event)) {
            event.preventDefault();
            return;
          }
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
          "m-0 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-inherit outline-none placeholder:text-muted-foreground/60",
          className,
        )}
      />
      {children}
    </div>
  );
}

/** Заголовок страницы и вводный абзац: большие поля без рамок, как в начале страницы GitBook. */
export function PlainArea({
  value,
  onChange,
  placeholder,
  label,
  className,
  maxLength,
  singleLine,
  onEnter,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
  maxLength?: number;
  singleLine?: boolean;
  onEnter?: () => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: высоту нужно пересчитывать при каждом изменении значения
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={area}
      rows={1}
      value={value}
      maxLength={maxLength}
      aria-label={label}
      placeholder={placeholder}
      onChange={(event) => onChange(singleLine ? event.target.value.replace(/\n/g, " ") : event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey && onEnter) {
          event.preventDefault();
          onEnter();
        }
      }}
      className={cn(
        "m-0 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:text-muted-foreground/50",
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Блоки                                                                */
/* ------------------------------------------------------------------ */

type Ctx = {
  actions: BlockActions;
  /** Вставить блок после afterId и поставить в него курсор */
  insertAfter: (kind: BlockKind, afterId: string | null) => void;
  /** Редактор встроен в страницу гайда: кнопки блока остаются внутри колонки, а не на поле слева */
  inline: boolean;
  /** Поставить курсор в предыдущий блок и удалить этот */
  removeAndFocusPrev: (id: string) => void;
};

/** Текстовый абзац с меню «/»: если начать строку со «/», появляется список видов блока. */
function TextBlock({ block, ctx }: { block: Extract<EditorBlock, { type: "text" }>; ctx: Ctx }) {
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(0);

  const query =
    block.text.startsWith("/") && !block.text.includes("\n") ? block.text.slice(1).trim().toLowerCase() : null;
  const items = query === null ? [] : SLASH_ITEMS.filter((item) => matches(item, query));
  const open = editing && items.length > 0;
  const current = Math.min(active, Math.max(items.length - 1, 0));

  const pick = (item: SlashItem) => {
    if (item.kind === "route" || item.kind === "key") {
      // Вставка в текст: пример выделяется, чтобы его сразу можно было переписать
      const example = item.kind === "route" ? "Телефон > Приложение" : "F10";
      const [open, close] = item.kind === "route" ? ["[[", "]]"] : ["{{", "}}"];
      ctx.actions.update(block.id, { text: `${open}${example}${close}` });
      requestAnimationFrame(() => {
        const area = document.querySelector<HTMLTextAreaElement>(`[data-block-id="${block.id}"] textarea`);
        area?.focus();
        area?.setSelectionRange(2, 2 + example.length);
      });
      return;
    }
    ctx.actions.replace(block.id, item.kind);
    requestAnimationFrame(() => focusField(block.id));
  };

  return (
    <DocField
      rich
      value={block.text}
      label="Текст"
      placeholder="Введите текст или «/» для выбора блока"
      maxLength={JOB_LIMITS.blockText}
      className="text-base leading-7"
      onChange={(text) => {
        setActive(0);
        ctx.actions.update(block.id, { text });
      }}
      onEditingChange={setEditing}
      onEnter={() => ctx.insertAfter("text", block.id)}
      onBackspaceEmpty={() => ctx.removeAndFocusPrev(block.id)}
      onKeyDownIntercept={(event) => {
        if (!open) return false;
        if (event.key === "ArrowDown") setActive((current + 1) % items.length);
        else if (event.key === "ArrowUp") setActive((current - 1 + items.length) % items.length);
        else if (event.key === "Enter") pick(items[current]);
        else return false;
        return true;
      }}
    >
      {open && <SlashMenu items={items} active={current} onPick={pick} onHover={setActive} />}
    </DocField>
  );
}

type ListBlock = Extract<EditorBlock, { type: "list" }>;

/** Список: каждый пункт правится отдельно. Enter добавляет пункт, Enter в пустом последнем выходит из списка. */
function ListBlockEditor({ block, ctx }: { block: ListBlock; ctx: Ctx }) {
  const items = block.text === "" ? [""] : block.text.split("\n");
  const [focus, setFocus] = useState<{ index: number; token: number }>({ index: -1, token: 0 });
  const focusOn = (index: number) => setFocus((prev) => ({ index, token: prev.token + 1 }));
  const commit = (next: string[]) => ctx.actions.update(block.id, { text: next.join("\n") });

  const change = (index: number, value: string) => {
    // Вставка нескольких строк сразу разбивается на пункты
    const next = [...items];
    next.splice(index, 1, ...value.split("\n"));
    commit(next);
  };

  const enter = (index: number) => {
    if (items[index] === "" && index === items.length - 1 && items.length > 1) {
      commit(items.slice(0, -1));
      ctx.insertAfter("text", block.id);
      return;
    }
    if (items.length >= JOB_LIMITS.listItems) return;
    const next = [...items];
    next.splice(index + 1, 0, "");
    focusOn(index + 1);
    commit(next);
  };

  const backspaceEmpty = (index: number) => {
    if (items.length === 1) {
      // Последний пустой пункт: список превращается обратно в абзац
      ctx.actions.replace(block.id, "text");
      requestAnimationFrame(() => focusField(block.id));
      return;
    }
    focusOn(Math.max(0, index - 1));
    commit(items.filter((_, i) => i !== index));
  };

  const field = (item: string, index: number) => (
    <DocField
      rich
      singleLine
      value={item}
      focusToken={focus.index === index ? focus.token : 0}
      label={block.ordered ? `Шаг ${index + 1}` : `Пункт ${index + 1}`}
      placeholder={block.ordered ? "Опишите шаг" : "Опишите пункт"}
      maxLength={JOB_LIMITS.item}
      className="text-base leading-7"
      onChange={(value) => change(index, value)}
      onEnter={() => enter(index)}
      onBackspaceEmpty={() => backspaceEmpty(index)}
    />
  );

  return block.ordered ? (
    <ol className="flex flex-col gap-1">
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: пункты не имеют собственных id
        <li key={index} className="flex items-start gap-3">
          <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary text-xs">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">{field(item, index)}</span>
        </li>
      ))}
    </ol>
  ) : (
    <ul className="flex list-disc flex-col gap-1 pl-6 marker:text-muted-foreground">
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: пункты не имеют собственных id
        <li key={index}>{field(item, index)}</li>
      ))}
    </ul>
  );
}

const variantOrder: CalloutVariant[] = ["tip", "info", "warning"];

function CalloutBlockEditor({ block, ctx }: { block: Extract<EditorBlock, { type: "callout" }>; ctx: Ctx }) {
  const { box, icon, Icon } = calloutStyle[block.variant];
  const next = variantOrder[(variantOrder.indexOf(block.variant) + 1) % variantOrder.length];

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border-l-2 px-4 py-3", box)}>
      <button
        type="button"
        title={`Вид: ${calloutVariants[block.variant]}. Нажмите, чтобы сменить на «${calloutVariants[next]}»`}
        aria-label={`Вид выделения: ${calloutVariants[block.variant]}. Сменить на «${calloutVariants[next]}»`}
        onClick={() => ctx.actions.update(block.id, { variant: next })}
        className="mt-1 shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Icon className={cn("size-4", icon)} aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <DocField
          rich
          value={block.text}
          label={calloutVariants[block.variant]}
          placeholder={`${calloutVariants[block.variant]}: введите текст`}
          maxLength={JOB_LIMITS.blockText}
          className="text-base leading-7"
          onChange={(text) => ctx.actions.update(block.id, { text })}
          onEnter={() => ctx.insertAfter("text", block.id)}
          onBackspaceEmpty={() => ctx.removeAndFocusPrev(block.id)}
        />
      </div>
    </div>
  );
}

function BlockContent({ block, ctx }: { block: EditorBlock; ctx: Ctx }) {
  switch (block.type) {
    case "heading":
      return (
        <h2>
          <DocField
            singleLine
            value={block.text}
            label="Заголовок раздела"
            placeholder="Заголовок раздела"
            maxLength={JOB_LIMITS.sectionTitle}
            className="font-semibold text-2xl tracking-tight"
            onChange={(text) => ctx.actions.update(block.id, { text })}
            onEnter={() => ctx.insertAfter("text", block.id)}
            onBackspaceEmpty={() => ctx.removeAndFocusPrev(block.id)}
          />
        </h2>
      );
    case "text":
      return <TextBlock block={block} ctx={ctx} />;
    case "list":
      return <ListBlockEditor block={block} ctx={ctx} />;
    case "callout":
      return <CalloutBlockEditor block={block} ctx={ctx} />;
    case "image":
      return <ImageBody block={block} actions={ctx.actions} />;
    case "slider":
      return <SliderBody block={block} actions={ctx.actions} />;
    case "map":
      return <MapBody block={block} actions={ctx.actions} />;
    case "textImage":
      return (
        <div className="flex flex-col gap-3">
          <SideToggle block={block} actions={ctx.actions} />
          <div
            className={cn(
              "flex flex-col gap-4 sm:items-start",
              block.side === "left" ? "sm:flex-row" : "sm:flex-row-reverse",
            )}
          >
            <div className="w-full shrink-0 sm:w-[38%] sm:max-w-sm">
              <ImageBody block={block} actions={ctx.actions} compact />
            </div>
            <div className="min-w-0 flex-1">
              <DocField
                rich
                blocks
                value={block.text}
                label="Текст рядом с картинкой"
                placeholder="Объяснение рядом с картинкой"
                maxLength={JOB_LIMITS.blockText}
                className="text-base leading-7"
                onChange={(text) => ctx.actions.update(block.id, { text })}
              />
            </div>
          </div>
        </div>
      );
  }
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

/**
 * Один блок документа. Слева (на телефоне — справа сверху) при наведении или фокусе появляются «+» и «⋮»:
 * добавить блок ниже, переместить, дублировать, удалить.
 */
function DocBlock({ block, index, count, ctx }: { block: EditorBlock; index: number; count: number; ctx: Ctx }) {
  const { actions } = ctx;
  const label = blockLabel(block);
  const busy =
    ((block.type === "image" || block.type === "textImage") && block.uploading) ||
    (block.type === "slider" && block.slides.some((slide) => slide.uploading));

  return (
    <div
      data-block-id={block.id}
      className={cn("group/block relative", block.type === "heading" && index > 0 && "mt-6")}
    >
      <div
        className={cn(
          "absolute top-0 right-0 z-10 flex items-center gap-0.5 rounded-md border bg-background opacity-0 shadow-xs transition-opacity group-focus-within/block:opacity-100 group-hover/block:opacity-100 has-data-[state=open]:opacity-100",
          !ctx.inline &&
            "lg:top-0.5 lg:right-auto lg:-left-14 lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none",
        )}
      >
        <AddBlockMenu
          onAdd={(kind) => ctx.insertAfter(kind, block.id)}
          onTemplates={() => actions.openTemplates(block.id)}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Добавить блок после «${label}»`}
            className="text-muted-foreground"
          >
            <Plus />
          </Button>
        </AddBlockMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Действия с блоком «${label}»`}
              className="text-muted-foreground"
            >
              <GripVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem disabled={index === 0} onSelect={() => actions.move(block.id, -1)}>
              <ArrowUp /> Выше
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === count - 1} onSelect={() => actions.move(block.id, 1)}>
              <ArrowDown /> Ниже
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onSelect={() => actions.duplicate(block.id)}>
              <Copy /> Дублировать
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(block.id)}>
              <Trash2 /> Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <BlockContent block={block} ctx={ctx} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Документ                                                             */
/* ------------------------------------------------------------------ */

const START = "__start__";

/**
 * Редактор содержимого гайда в духе GitBook: один столбец без карточек и рамок, текст пишется прямо на странице.
 * «/» открывает список блоков, Enter создаёт новый абзац, «+» и «⋮» слева от блока — добавить, переместить, удалить.
 */
export function GuideDocEditor({
  blocks,
  actions,
  inline = false,
}: {
  blocks: EditorBlock[];
  actions: BlockActions;
  /** Редактор внутри страницы гайда (с нижней панелью сохранения), а не отдельная страница */
  inline?: boolean;
}) {
  // Куда поставить курсор после вставки блока: id блока, после которого вставили (или START)
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const anchor = pendingFocus.current;
    if (anchor === null) return;
    pendingFocus.current = null;
    const index = anchor === START ? -1 : blocks.findIndex((block) => block.id === anchor);
    const target = blocks[index + 1];
    if (target) requestAnimationFrame(() => focusField(target.id));
  }, [blocks]);

  const ctx: Ctx = {
    actions,
    inline,
    insertAfter: (kind, afterId) => {
      pendingFocus.current = afterId ?? START;
      actions.insert(kind, afterId);
    },
    removeAndFocusPrev: (id) => {
      const index = blocks.findIndex((block) => block.id === id);
      const previous = blocks[index - 1];
      if (previous) focusField(previous.id);
      actions.remove(id);
    },
  };

  const last = blocks.at(-1);

  return (
    <div className="flex flex-col gap-3">
      {blocks.length === 0 ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => ctx.insertAfter("text", null)}
            className="cursor-text text-left text-base text-muted-foreground/60 leading-7"
          >
            Начните писать или введите «/» для выбора блока
          </button>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => actions.openTemplates(null)}>
              Начать с шаблона
            </Button>
          </div>
        </div>
      ) : (
        blocks.map((block, index) => (
          <DocBlock key={block.id} block={block} index={index} count={blocks.length} ctx={ctx} />
        ))
      )}

      <div className={cn("fixed right-5 z-30 sm:right-7", inline ? "bottom-20" : "bottom-6")}>
        <AddBlockMenu
          onAdd={(kind) => ctx.insertAfter(kind, last?.id ?? null)}
          onTemplates={() => actions.openTemplates(last?.id ?? null)}
        >
          <Button
            type="button"
            size="lg"
            disabled={blocks.length >= JOB_LIMITS.blocks}
            className="h-11 rounded-full px-5 shadow-black/10 shadow-lg"
          >
            <Plus data-icon="inline-start" /> Добавить блок
          </Button>
        </AddBlockMenu>
      </div>

      {last && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: область нужна только мыши, с клавиатуры блоки добавляются через меню
        // biome-ignore lint/a11y/noStaticElementInteractions: пустое место под текстом, как в обычном редакторе
        <div
          className="min-h-24 cursor-text"
          onClick={() => {
            if (last.type === "text" && last.text === "") focusField(last.id);
            else ctx.insertAfter("text", last.id);
          }}
        />
      )}
    </div>
  );
}
