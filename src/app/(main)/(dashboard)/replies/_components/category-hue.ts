import type { CSSProperties } from "react";

/** Оттенки (шкала oklch), подобранные так, чтобы соседние категории хорошо различались. */
const HUES = [20, 55, 95, 150, 185, 225, 265, 305, 340] as const;

/** Цвет категории зависит только от её названия, поэтому не меняется, когда добавляют новые категории. */
export function categoryHue(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return HUES[hash % HUES.length];
}

/** Кладёт оттенок в CSS-переменную --h, из неё берут цвет классы вида bg-[oklch(0.96_0.035_var(--h))]. */
export const hueStyle = (hue: number): CSSProperties => ({ "--h": hue }) as CSSProperties;
