import { useEffect, useState } from "react";

import type { RuleGroup } from "./rules-meta";

export type SemanticHit = { slug: string; anchor: string; score: number };

type Loaded = { query: string; status: "loading" | "done" | "error"; hits: SemanticHit[] };

/**
 * Поиск по смыслу через сервер (embedding API). Запрос уходит с небольшой задержкой, чтобы не тратить его на каждую букву.
 * Пустой query означает «не искать».
 */
export function useSemanticRules({
  enabled,
  group,
  query,
}: {
  enabled: boolean;
  group: RuleGroup;
  query: string;
}): { hits: SemanticHit[]; loading: boolean; failed: boolean } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!enabled || !query) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoaded({ query, status: "loading", hits: [] });
      try {
        const response = await fetch(`/api/rules/semantic?${new URLSearchParams({ q: query, group })}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { hits?: SemanticHit[] };
        setLoaded({ query, status: "done", hits: body.hits ?? [] });
      } catch {
        if (!controller.signal.aborted) setLoaded({ query, status: "error", hits: [] });
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, group, query]);

  const current = loaded && loaded.query === query ? loaded : null;
  return {
    hits: current?.hits ?? [],
    loading: Boolean(query) && (!current || current.status === "loading"),
    failed: current?.status === "error",
  };
}
