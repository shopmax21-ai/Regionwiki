import type { ResolvedThemeMode, ThemeMode } from "./theme";

/** Тема только светлая или тёмная: системная не используется, выбор делает сам посетитель. */
export function applyThemeMode(mode: ThemeMode): ResolvedThemeMode {
  const resolved: ResolvedThemeMode = mode === "dark" ? "dark" : "light";
  const doc = document.documentElement;
  doc.setAttribute("data-theme-mode", mode);
  doc.classList.add("disable-transitions");
  doc.classList.toggle("dark", resolved === "dark");
  doc.style.colorScheme = resolved;
  requestAnimationFrame(() => {
    doc.classList.remove("disable-transitions");
  });
  return resolved;
}
