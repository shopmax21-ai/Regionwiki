import { Roboto, Roboto_Mono } from "next/font/google";

// Сайт на русском, поэтому подключаем кириллицу: без неё русский текст рисуется системным шрифтом.
const roboto = Roboto({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
});

// Моноширинный вариант для кодов, команд и ID (класс font-mono).
const robotoMono = Roboto_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-roboto-mono",
});

export const fontRegistry = {
  roboto: {
    label: "Roboto",
    font: roboto,
  },
} as const;

export type FontKey = keyof typeof fontRegistry;

export const fontKeys = Object.keys(fontRegistry) as FontKey[];

export const fontVars = [roboto.variable, robotoMono.variable].join(" ");

export const fontOptions = fontKeys.map((key) => ({
  key,
  label: fontRegistry[key].label,
}));
