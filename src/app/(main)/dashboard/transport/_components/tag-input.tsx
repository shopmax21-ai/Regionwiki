"use client";

import { type ClipboardEvent, type KeyboardEvent, useState } from "react";

import { cn } from "cn";
import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type TagInputProps = {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  /** Подсказки: нажатие добавляет значение одним кликом */
  suggestions?: string[];
  placeholder?: string;
  maxItems: number;
  maxLength: number;
  invalid?: boolean;
};

/** Разбивает вставленный текст по переводам строк, запятым и точкам с запятой. */
const split = (text: string) =>
  text
    .split(/[\n,;]/)
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * Список значений в виде «плашек»: Enter или запятая добавляют, Backspace в пустом поле убирает последнюю,
 * вставленный список через запятую или с новых строк разбирается сразу на плашки.
 */
export function TagInput({
  id,
  values,
  onChange,
  suggestions = [],
  placeholder,
  maxItems,
  maxLength,
  invalid = false,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  const add = (incoming: string[]) => {
    const next = [...values];
    for (const raw of incoming) {
      const value = raw.slice(0, maxLength);
      if (next.length >= maxItems) break;
      if (!next.some((existing) => existing.toLowerCase() === value.toLowerCase())) next.push(value);
    }
    if (next.length !== values.length) onChange(next);
  };

  const commit = () => {
    const parts = split(draft);
    if (parts.length > 0) add(parts);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      // Enter в поле не должен отправлять форму или закрывать окно
      event.preventDefault();
      event.stopPropagation();
      commit();
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!/[\n,;]/.test(text)) return;
    event.preventDefault();
    add(split(text));
  };

  let inputPlaceholder = placeholder;
  if (values.length >= maxItems) inputPlaceholder = "Достигнут предел";
  else if (values.length > 0) inputPlaceholder = "Ещё источник...";

  const free = suggestions.filter((item) => !values.some((value) => value.toLowerCase() === item.toLowerCase()));
  const full = values.length >= maxItems;

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
          invalid && "border-destructive ring-3 ring-destructive/20",
        )}
      >
        {values.map((value) => (
          <Badge key={value} variant="secondary" className="gap-1 pr-0.5">
            {value}
            <button
              type="button"
              aria-label={`Убрать источник «${value}»`}
              className="rounded-sm p-0.5 text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          id={id}
          value={draft}
          disabled={full}
          maxLength={maxLength * 2}
          aria-invalid={invalid}
          placeholder={inputPlaceholder}
          className="min-w-32 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={commit}
        />
      </div>

      {free.length > 0 && !full && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Быстро:</span>
          {free.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => add([item])}
              className="flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-muted-foreground text-xs outline-none transition-colors hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3" aria-hidden="true" />
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
