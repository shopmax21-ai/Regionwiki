"use client";

import { useCallback, useSyncExternalStore } from "react";

import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";

import type { RuleGroup } from "./rules-meta";

/**
 * Избранные пункты правил хранятся в браузере (как избранное в быстрых ответах), поэтому у каждого свой список.
 * Элемент списка — «группа/раздел#якорь пункта», например «general/obschie-pravila#rule-1-3».
 */
const FAVORITES_KEY = "region-rules-favorites";
const MAX_FAVORITES = 500;

const EMPTY: string[] = [];
const listeners = new Set<() => void>();
let cache: { raw: string | null; list: string[] } = { raw: null, list: EMPTY };
// Запасной список на случай, когда браузер не даёт писать в localStorage (например, приватный режим)
let memoryOnly: string[] | null = null;

export const ruleFavoriteKey = (group: RuleGroup, slug: string, anchor: string) => `${group}/${slug}#${anchor}`;

/** Любой мусор в хранилище отбрасываем. */
function parse(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_FAVORITES)
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): string[] {
  if (memoryOnly) return memoryOnly;
  const raw = getLocalStorageValue(FAVORITES_KEY);
  if (raw !== cache.raw) cache = { raw, list: parse(raw) };
  return cache.list;
}

const getServerSnapshot = () => EMPTY;

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Другая вкладка изменила список
  const onStorage = (event: StorageEvent) => {
    if (event.key === FAVORITES_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function toggleKey(key: string) {
  const current = getSnapshot();
  const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
  const raw = JSON.stringify(next);
  setLocalStorageValue(FAVORITES_KEY, raw);
  // Если запись не удалась, список живёт до перезагрузки страницы, но звезда всё равно срабатывает
  memoryOnly = getLocalStorageValue(FAVORITES_KEY) === raw ? null : next;
  for (const listener of listeners) listener();
}

export function useRuleFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isFavorite = useCallback((key: string) => favorites.includes(key), [favorites]);
  return { favorites, isFavorite, toggleFavorite: toggleKey };
}
