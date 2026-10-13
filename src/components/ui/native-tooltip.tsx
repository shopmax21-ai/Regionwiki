"use client";

import { useEffect, useRef, useState } from "react";

import { createPortal } from "react-dom";

type Tip = { text: string; x: number; y: number; below: boolean };

const SKIP_TAGS = new Set(["IFRAME", "svg", "SVG", "TITLE"]);

/**
 * Заменяет нативные браузерные подсказки (атрибут `title`) на стилизованные.
 * Работает глобально: достаточно один раз подключить в корневом layout.
 */
export function NativeTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [mounted, setMounted] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);

    const restore = (el: HTMLElement | null) => {
      if (!el) return;
      const saved = el.getAttribute("data-native-title");
      if (saved !== null && !el.hasAttribute("title")) {
        el.setAttribute("title", saved);
      }
      el.removeAttribute("data-native-title");
    };

    const hide = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      restore(activeRef.current);
      activeRef.current = null;
      setTip(null);
    };

    const show = (el: HTMLElement, text: string) => {
      const rect = el.getBoundingClientRect();
      const below = rect.top < 48;
      setTip({
        text,
        x: rect.left + rect.width / 2,
        y: below ? rect.bottom + 6 : rect.top - 6,
        below,
      });
    };

    const findTarget = (node: EventTarget | null): HTMLElement | null => {
      let el = node instanceof Element ? node : null;
      while (el && el !== document.body) {
        if (el instanceof HTMLElement && !SKIP_TAGS.has(el.tagName)) {
          const title = el.getAttribute("title") ?? el.getAttribute("data-native-title");
          if (title?.trim()) return el;
        }
        el = el.parentElement;
      }
      return null;
    };

    const onOver = (event: MouseEvent) => {
      const el = findTarget(event.target);
      if (el === activeRef.current) return;
      hide();
      if (!el) return;
      const text = el.getAttribute("title") ?? el.getAttribute("data-native-title") ?? "";
      el.setAttribute("data-native-title", text);
      el.removeAttribute("title"); // убираем нативную подсказку браузера
      activeRef.current = el;
      timerRef.current = setTimeout(() => show(el, text), 250);
    };

    const onFocus = (event: FocusEvent) => {
      const el = findTarget(event.target);
      if (!el || el === activeRef.current) return;
      hide();
      const text = el.getAttribute("title") ?? el.getAttribute("data-native-title") ?? "";
      el.setAttribute("data-native-title", text);
      el.removeAttribute("title");
      activeRef.current = el;
      show(el, text);
    };

    const onOut = (event: MouseEvent) => {
      const active = activeRef.current;
      if (!active) return;
      const next = event.relatedTarget;
      if (next instanceof Node && active.contains(next)) return;
      hide();
    };

    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", onOut, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", hide, true);
    document.addEventListener("mousedown", hide, true);
    document.addEventListener("keydown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);

    return () => {
      hide();
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", onOut, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", hide, true);
      document.removeEventListener("mousedown", hide, true);
      document.removeEventListener("keydown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);

  // Не даём подсказке выйти за границы окна по горизонтали.
  useEffect(() => {
    const node = tipRef.current;
    if (!node || !tip) return;
    const { width } = node.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(tip.x - width / 2, margin), window.innerWidth - width - margin);
    node.style.left = `${left}px`;
  }, [tip]);

  if (!(mounted && tip)) return null;

  return createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      style={{
        position: "fixed",
        top: tip.y,
        left: tip.x,
        transform: tip.below ? "none" : "translateY(-100%)",
      }}
      className="pointer-events-none z-[9999] w-fit max-w-xs animate-in rounded-md bg-foreground px-3 py-1.5 text-background text-xs fade-in-0 zoom-in-95"
    >
      {tip.text}
    </div>,
    document.body,
  );
}
