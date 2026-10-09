import { Keyboard, Sparkles, SpellCheck, TextSearch } from "lucide-react";

import type { SmartResult } from "@/lib/rules/smart-search";

/** Пояснения к умному поиску: что распознано, что исправлено, почему показаны частичные совпадения. */
export function RuleSearchNotes({ result }: { result: SmartResult }) {
  const { concepts, corrections, layoutFixed, partial } = result;
  if (concepts.length === 0 && corrections.length === 0 && !layoutFixed && !partial) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {concepts.map((concept) => (
        <span
          key={concept.id}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-medium text-primary"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          {concept.label}
        </span>
      ))}
      {layoutFixed && (
        <span className="inline-flex items-center gap-1.5">
          <Keyboard className="size-3.5" aria-hidden="true" />
          Неверная раскладка, ищем «{layoutFixed}»
        </span>
      )}
      {corrections.length > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <SpellCheck className="size-3.5" aria-hidden="true" />
          Исправлено: {corrections.map((item) => `${item.from} → ${item.to}`).join(", ")}
        </span>
      )}
      {partial && (
        <span className="inline-flex items-center gap-1.5">
          <TextSearch className="size-3.5" aria-hidden="true" />
          Нет пунктов со всеми словами, показаны подходящие частично
        </span>
      )}
    </div>
  );
}
