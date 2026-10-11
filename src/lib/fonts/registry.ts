import { JetBrains_Mono, Onest, Unbounded } from "next/font/google";

// Сайт на русском, поэтому везде подключаем кириллицу: без неё русский текст рисуется системным шрифтом.

// Основной текст: нейтральный гротеск Onest.
const onest = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
  display: "swap",
});

// Заголовки: характерный широкий шрифт Unbounded.
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  display: "swap",
});

// Моноширинный: ID, Static ID, команды и цифры в таблицах (классы font-mono и tabular-nums).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const fontRegistry = {
  onest: {
    label: "Onest",
    font: onest,
  },
} as const;

export type FontKey = keyof typeof fontRegistry;

export const fontKeys = Object.keys(fontRegistry) as FontKey[];

export const fontOptions = fontKeys.map((key) => ({ key, label: fontRegistry[key].label }));

export const fontVars = [onest.variable, unbounded.variable, jetbrainsMono.variable].join(" ");
