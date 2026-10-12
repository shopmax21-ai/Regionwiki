import { JetBrains_Mono, Onest, Unbounded } from "next/font/google";

// Сайт на русском, поэтому везде подключаем кириллицу: без неё русский текст рисуется системным шрифтом.

// Основной текст: нейтральный, с табличными цифрами.
const onest = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
});

// Заголовки: широкий шрифт с характером.
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
});

// ID, Static ID, номера заявок, Telegram ID и коды (класс font-mono).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains-mono",
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
