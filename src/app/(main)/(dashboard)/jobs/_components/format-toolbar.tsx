"use client";

import { type ComponentProps, useRef } from "react";

import { cn } from "cn";
import {
  Bold,
  Code,
  Highlighter,
  Italic,
  Keyboard,
  List,
  ListOrdered,
  type LucideIcon,
  Route,
  Strikethrough,
  Underline,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Форматирование хранится в тексте обычными знаками: **жирный**, *курсив*, __подчёркнутый__, ~~зачёркнутый~~, ==выделение==. */
export const FORMATS: readonly {
  id: string;
  delimiter: string;
  label: string;
  /** Клавиша для Ctrl/Cmd; у зачёркивания и выделения сочетаний нет */
  key?: "b" | "i" | "u";
  code?: "KeyB" | "KeyI" | "KeyU";
  icon: LucideIcon;
}[] = [
  { id: "bold", delimiter: "**", label: "Жирный", key: "b", code: "KeyB", icon: Bold },
  { id: "italic", delimiter: "*", label: "Курсив", key: "i", code: "KeyI", icon: Italic },
  { id: "underline", delimiter: "__", label: "Подчёркнутый", key: "u", code: "KeyU", icon: Underline },
  { id: "strike", delimiter: "~~", label: "Зачёркнутый", icon: Strikethrough },
  { id: "highlight", delimiter: "==", label: "Выделение цветом", icon: Highlighter },
  { id: "code", delimiter: "`", label: "Команда или кнопка (моноширинный текст)", icon: Code },
];

type Edit = { value: string; start: number; end: number };

const isSpace = (char: string | undefined) => char === undefined || /\s/.test(char);

/** Сколько знаков `*` подряд стоит перед позицией и после неё: по ним отличаем *курсив* от **жирного** */
function starRuns(text: string, start: number, end: number) {
  let before = 0;
  while (text[start - 1 - before] === "*") before += 1;
  let after = 0;
  while (text[end + after] === "*") after += 1;
  return { before, after };
}

function hasOutside(text: string, start: number, end: number, delimiter: string) {
  if (delimiter === "*") {
    const { before, after } = starRuns(text, start, end);
    return Math.min(before, after) % 2 === 1;
  }
  if (delimiter === "**") {
    const { before, after } = starRuns(text, start, end);
    return Math.min(before, after) >= 2;
  }
  const size = delimiter.length;
  return text.slice(start - size, start) === delimiter && text.slice(end, end + size) === delimiter;
}

function hasInside(selected: string, delimiter: string) {
  const size = delimiter.length;
  if (selected.length <= size * 2) return false;
  if (!selected.startsWith(delimiter) || !selected.endsWith(delimiter)) return false;
  if (delimiter === "*") return !selected.startsWith("**") && !selected.endsWith("**");
  return true;
}

/** Применяет или снимает один вид форматирования для выделенного фрагмента [start, end). */
function toggleOne(text: string, start: number, end: number, delimiter: string): Edit {
  const size = delimiter.length;

  // Пустое выделение: берём слово под курсором, а если курсор не в слове, вставляем пару знаков
  if (start === end) {
    let from = start;
    let to = end;
    while (from > 0 && !isSpace(text[from - 1])) from -= 1;
    while (to < text.length && !isSpace(text[to])) to += 1;
    if (from === to) {
      return {
        value: text.slice(0, start) + delimiter + delimiter + text.slice(end),
        start: start + size,
        end: start + size,
      };
    }
    return toggleOne(text, from, to, delimiter);
  }

  // Пробелы по краям выделения в разметку не попадают: закрывающий знак должен стоять сразу за словом
  let from = start;
  let to = end;
  while (from < to && isSpace(text[from])) from += 1;
  while (to > from && isSpace(text[to - 1])) to -= 1;
  if (from === to) return { value: text, start, end };

  if (hasOutside(text, from, to, delimiter)) {
    return {
      value: text.slice(0, from - size) + text.slice(from, to) + text.slice(to + size),
      start: from - size,
      end: to - size,
    };
  }

  const selected = text.slice(from, to);
  if (hasInside(selected, delimiter)) {
    const inner = selected.slice(size, selected.length - size);
    return { value: text.slice(0, from) + inner + text.slice(to), start: from, end: from + inner.length };
  }

  return {
    value: `${text.slice(0, from)}${delimiter}${selected}${delimiter}${text.slice(to)}`,
    start: from + size,
    end: to + size,
  };
}

/**
 * Форматирует выделенный текст в textarea. В списках (perLine) каждая строка-пункт оформляется отдельно,
 * потому что пункты разбираются независимо друг от друга.
 */
export function formatSelection(
  element: HTMLTextAreaElement,
  delimiter: string,
  onChange: (value: string) => void,
  perLine = false,
) {
  const { value, selectionStart, selectionEnd } = element;
  let edit: Edit;

  if (perLine && selectionStart !== selectionEnd && value.slice(selectionStart, selectionEnd).includes("\n")) {
    // Идём с конца к началу, чтобы сдвиги от вставленных знаков не ломали позиции предыдущих строк
    let text = value;
    const segments: { from: number; to: number }[] = [];
    let cursor = selectionStart;
    for (const part of value.slice(selectionStart, selectionEnd).split("\n")) {
      segments.push({ from: cursor, to: cursor + part.length });
      cursor += part.length + 1;
    }
    let lastEnd = selectionEnd;
    for (const segment of segments.reverse()) {
      if (segment.from === segment.to) continue;
      const result = toggleOne(text, segment.from, segment.to, delimiter);
      lastEnd += result.value.length - text.length;
      text = result.value;
    }
    edit = { value: text, start: selectionStart, end: lastEnd };
  } else {
    edit = toggleOne(value, selectionStart, selectionEnd, delimiter);
  }

  if (edit.value === value) return;
  onChange(edit.value);
  // Выделение возвращается после того, как React применит новое значение
  requestAnimationFrame(() => {
    element.focus();
    element.setSelectionRange(edit.start, edit.end);
  });
}

/** Границы строк, которых касается выделение: [начало первой строки, конец последней). */
function lineRange(value: string, start: number, end: number) {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", end);
  return { from, to: nextBreak === -1 ? value.length : nextBreak };
}

const NUMBER_PREFIX = /^\d{1,3}[.)]\s+/;
const BULLET_PREFIX = /^[-•]\s+/;

/**
 * Превращает выделенные строки в нумерованный или маркированный список (или снимает список, если он уже есть).
 * Номера расставляются заново с единицы: «1. », «2. »…
 */
export function toggleListLines(
  element: HTMLTextAreaElement,
  kind: "ordered" | "bullet",
  onChange: (value: string) => void,
) {
  const { value, selectionStart, selectionEnd } = element;
  const { from, to } = lineRange(value, selectionStart, selectionEnd);
  const lines = value.slice(from, to).split("\n");
  const prefix = kind === "ordered" ? NUMBER_PREFIX : BULLET_PREFIX;
  const content = lines.filter((line) => line.trim() !== "");
  const allMarked = content.length > 0 && content.every((line) => prefix.test(line.trim()));

  let counter = 0;
  const next = lines.map((line) => {
    if (line.trim() === "") return line;
    const clean = line.trim().replace(NUMBER_PREFIX, "").replace(BULLET_PREFIX, "");
    if (allMarked) return clean;
    counter += 1;
    return kind === "ordered" ? `${counter}. ${clean}` : `- ${clean}`;
  });

  const replaced = next.join("\n");
  onChange(value.slice(0, from) + replaced + value.slice(to));
  requestAnimationFrame(() => {
    element.focus();
    element.setSelectionRange(from, from + replaced.length);
  });
}

/**
 * Оформляет выделенный текст как маршрут: «Телефон > Whaash» превращается в [[Телефон > Whaash]].
 * Без выделения вставляет заготовку с выделенным примером, который можно сразу переписать.
 */
export function insertRoute(element: HTMLTextAreaElement, onChange: (value: string) => void) {
  const { value, selectionStart, selectionEnd } = element;
  const selected = value.slice(selectionStart, selectionEnd).trim();

  // Выделен уже готовый маршрут: убираем скобки
  const wrapped = /^\[\[([\s\S]+)\]\]$/.exec(selected);
  if (wrapped?.[1]) {
    onChange(value.slice(0, selectionStart) + wrapped[1] + value.slice(selectionEnd));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(selectionStart, selectionStart + wrapped[1].length);
    });
    return;
  }

  const body = selected.replace(/\n+/g, " ") || "Телефон > Приложение";
  const text = `[[${body}]]`;
  onChange(value.slice(0, selectionStart) + text + value.slice(selectionEnd));
  requestAnimationFrame(() => {
    element.focus();
    // Выделяем только содержимое, чтобы пример сразу заменялся набором
    element.setSelectionRange(selectionStart + 2, selectionStart + 2 + body.length);
  });
}

/**
 * Оформляет выделенный текст как клавишу или сочетание: «Ctrl+C» превращается в {{Ctrl+C}}.
 * Без выделения вставляет заготовку с выделенным примером.
 */
export function insertKey(element: HTMLTextAreaElement, onChange: (value: string) => void) {
  const { value, selectionStart, selectionEnd } = element;
  const selected = value.slice(selectionStart, selectionEnd).trim();

  const wrapped = /^\{\{([\s\S]+)\}\}$/.exec(selected);
  if (wrapped?.[1]) {
    onChange(value.slice(0, selectionStart) + wrapped[1] + value.slice(selectionEnd));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(selectionStart, selectionStart + wrapped[1].length);
    });
    return;
  }

  const body = selected.replace(/\n+/g, " ") || "F10";
  onChange(`${value.slice(0, selectionStart)}{{${body}}}${value.slice(selectionEnd)}`);
  requestAnimationFrame(() => {
    element.focus();
    element.setSelectionRange(selectionStart + 2, selectionStart + 2 + body.length);
  });
}

/** Ctrl/Cmd + B, I, U работают и на русской раскладке (проверяем физическую клавишу). */
export function handleFormatShortcut(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  onChange: (value: string) => void,
  perLine = false,
) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;
  const format = FORMATS.find((item) => item.code === event.code || item.key === event.key.toLowerCase());
  if (!format) return false;
  event.preventDefault();
  formatSelection(event.currentTarget, format.delimiter, onChange, perLine);
  return true;
}

type FormatToolbarProps = {
  getTextarea: () => HTMLTextAreaElement | null;
  onChange: (value: string) => void;
  perLine?: boolean;
  className?: string;
  /**
   * Кнопки нумерации, списка и маршрута. Нужны там, где в тексте можно писать несколько строк с разной формой
   * (текст рядом с картинкой); в самих списках и заметках они ни к чему.
   */
  blockTools?: boolean;
};

/** Панель кнопок форматирования. Нажатие не забирает фокус у поля, поэтому выделение остаётся на месте. */
export function FormatToolbar({ getTextarea, onChange, perLine, className, blockTools }: FormatToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Форматирование текста"
      className={cn("flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-md border bg-background p-0.5 shadow-xs", className)}
    >
      {FORMATS.map(({ id, delimiter, label, key, icon: Icon }) => (
        <Button
          key={id}
          type="button"
          variant="ghost"
          size="icon-xs"
          title={key ? `${label} (Ctrl+${key.toUpperCase()})` : label}
          aria-label={label}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const element = getTextarea();
            if (element) formatSelection(element, delimiter, onChange, perLine);
          }}
        >
          <Icon />
        </Button>
      ))}
      {blockTools && (
        <>
          <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Нумерованный список: каждая строка станет шагом 1, 2, 3…"
            aria-label="Нумерованный список"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const element = getTextarea();
              if (element) toggleListLines(element, "ordered", onChange);
            }}
          >
            <ListOrdered />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Маркированный список"
            aria-label="Маркированный список"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const element = getTextarea();
              if (element) toggleListLines(element, "bullet", onChange);
            }}
          >
            <List />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Маршрут по меню: Настройки > Защита аккаунта (каждый пункт в своём блоке)"
            aria-label="Маршрут по меню"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const element = getTextarea();
              if (element) insertRoute(element, onChange);
            }}
          >
            <Route />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Клавиша: {{F10}} или сочетание {{Ctrl+C}}"
            aria-label="Клавиша"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const element = getTextarea();
              if (element) insertKey(element, onChange);
            }}
          >
            <Keyboard />
          </Button>
        </>
      )}
    </div>
  );
}

type RichTextareaProps = Omit<ComponentProps<typeof Textarea>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
  perLine?: boolean;
  blockTools?: boolean;
};

/** Поле ввода с панелью форматирования и сочетаниями клавиш. */
export function RichTextarea({ value, onValueChange, perLine, blockTools, onKeyDown, ...props }: RichTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <FormatToolbar
        getTextarea={() => ref.current}
        onChange={onValueChange}
        perLine={perLine}
        blockTools={blockTools}
      />
      <Textarea
        {...props}
        ref={ref}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented) handleFormatShortcut(event, onValueChange, perLine);
        }}
      />
    </div>
  );
}
