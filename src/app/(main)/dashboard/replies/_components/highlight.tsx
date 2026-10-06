import type { ReactNode } from "react";

/** Подсвечивает в тексте найденные фрагменты запроса. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <>{text}</>;

  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  let index = lower.indexOf(needle, from);

  while (index !== -1) {
    if (index > from) parts.push(text.slice(from, index));
    parts.push(
      <mark key={index} className="rounded-sm bg-primary/20 px-0.5 text-inherit">
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    from = index + needle.length;
    index = lower.indexOf(needle, from);
  }
  parts.push(text.slice(from));

  return <>{parts}</>;
}
