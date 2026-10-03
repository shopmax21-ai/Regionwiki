"use client";

import { useEffect, useState } from "react";

import { MIN_QUERY_LENGTH, type SearchGroup } from "@/lib/search/types";

type State = {
  /** Для какого запроса получен ответ */
  query: string;
  groups: SearchGroup[];
  total: number;
  error: boolean;
};

const EMPTY: State = { query: "", groups: [], total: 0, error: false };

/** Живой поиск по всем разделам: запрос с задержкой, устаревшие ответы отбрасываются. */
export function useSiteSearch(rawQuery: string, { limit = 6, delay = 180 }: { limit?: number; delay?: number } = {}) {
  const query = rawQuery.trim();
  const active = query.length >= MIN_QUERY_LENGTH;
  const [state, setState] = useState<State>(EMPTY);

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { groups: SearchGroup[]; total: number };
        setState({ query, groups: data.groups, total: data.total, error: false });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setState({ query, groups: [], total: 0, error: true });
      }
    }, delay);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, query, limit, delay]);

  const ready = active && state.query === query;

  return {
    active,
    loading: active && !ready,
    groups: ready ? state.groups : [],
    total: ready ? state.total : 0,
    error: ready && state.error,
  };
}
