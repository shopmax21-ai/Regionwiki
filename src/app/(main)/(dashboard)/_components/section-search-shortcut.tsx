"use client";

import { useEffect } from "react";

/**
 * Ctrl + F (⌘ + F на Mac) переводит фокус в поиск по текущему разделу вместо поиска браузера.
 * Поле поиска раздела помечается атрибутом data-section-search. Если на странице такого поля нет
 * (например, на главной), срабатывает обычный поиск браузера.
 * Глобальный поиск по сайту открывается по Ctrl + E, см. header/search-dialog.tsx.
 */
export function SectionSearchShortcut() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.code !== "KeyF") return;
      if (event.defaultPrevented) return;

      const input = [...document.querySelectorAll<HTMLInputElement>("input[data-section-search]")].find(
        (item) => !item.disabled && item.getClientRects().length > 0,
      );
      if (!input) return;

      event.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
