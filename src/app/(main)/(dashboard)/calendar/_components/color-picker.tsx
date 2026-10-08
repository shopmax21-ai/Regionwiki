// biome-ignore-all lint/a11y/useSemanticElements: кнопка-цвет в радиогруппе ARIA
"use client";

import { useId } from "react";

import { Check, Palette } from "lucide-react";

import { EVENT_COLORS, isEventColor, readableTextOn } from "@/lib/calendar/types";

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

/**
 * Выбор цвета мероприятия: готовая палитра и свой оттенок. Цвет виден и в сетке календаря, и в списке мероприятий.
 * Управляется с клавиатуры: у каждого цвета своя кнопка, выбранный отмечен галочкой.
 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const labelId = useId();
  const current = value.toLowerCase();
  const inPalette = EVENT_COLORS.some((color) => color.value === current);

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="font-medium text-sm">
        Цвет в календаре
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
        {EVENT_COLORS.map((color) => {
          const selected = color.value === current;
          return (
            <button
              key={color.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color.label}
              title={color.label}
              onClick={() => onChange(color.value)}
              style={{ backgroundColor: color.value, color: readableTextOn(color.value) }}
              className="flex size-7 items-center justify-center rounded-md outline-none ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-ring aria-checked:ring-2 aria-checked:ring-foreground"
            >
              {selected && <Check className="size-4" aria-hidden="true" />}
            </button>
          );
        })}

        {/* Свой оттенок: системный выбор цвета лежит под круглой кнопкой */}
        <label
          title="Свой цвет"
          className="relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed text-muted-foreground ring-offset-2 ring-offset-background transition-shadow focus-within:ring-2 focus-within:ring-ring hover:ring-2 hover:ring-foreground/30 has-[input:checked]:ring-2"
          style={
            !inPalette && isEventColor(current)
              ? { backgroundColor: current, color: readableTextOn(current) }
              : undefined
          }
        >
          {!inPalette && isEventColor(current) ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Palette className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only">Свой цвет</span>
          <input
            type="color"
            value={isEventColor(current) ? current : EVENT_COLORS[0].value}
            onChange={(event) => onChange(event.target.value.toLowerCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label="Выбрать свой цвет"
          />
        </label>
      </div>
    </div>
  );
}
