"use client";

import { cn } from "cn";
import { Check, Copy, MessageSquareText } from "lucide-react";

import type { QuickReply } from "../_data/replies";
import { categoryHue, hueStyle } from "./category-hue";
import { Highlight } from "./highlight";
import { ReplyActions } from "./reply-actions";

type ReplyCardProps = {
  reply: QuickReply;
  categories: readonly string[];
  /** Показывать кнопки изменения и удаления */
  editable: boolean;
  /** Ответ только что скопирован */
  copied: boolean;
  onCopy: (reply: QuickReply) => void;
  /** Поисковый запрос: найденные фрагменты подсвечиваются */
  query: string;
};

/** Блок с готовым ответом: цвет категории в значке и рамке, весь блок нажимается и копирует текст. */
export function ReplyCard({ reply, categories, editable, copied, onCopy, query }: ReplyCardProps) {
  return (
    <article
      style={hueStyle(categoryHue(reply.category))}
      className={cn(
        "group/reply relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-[border-color,box-shadow] duration-200",
        "hover:border-[oklch(0.72_0.1_var(--h))] hover:shadow-md",
        copied && "border-[oklch(0.62_0.16_var(--h))] shadow-md ring-2 ring-[oklch(0.62_0.16_var(--h)/0.35)]",
      )}
    >
      <button
        type="button"
        onClick={() => onCopy(reply)}
        aria-label={`Скопировать ответ «${reply.title}»`}
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-3 p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.94_0.045_var(--h))] text-[oklch(0.45_0.14_var(--h))] dark:bg-[oklch(0.32_0.07_var(--h))] dark:text-[oklch(0.85_0.1_var(--h))]"
          >
            <MessageSquareText className="size-4.5" />
          </span>
          <span className="min-w-0 flex-1 pr-8 font-semibold leading-snug tracking-tight">
            <Highlight text={reply.title} query={query} />
          </span>
        </span>

        <span className="whitespace-pre-line break-words rounded-xl bg-muted/50 px-3.5 py-3 text-foreground/90 text-sm leading-6">
          <Highlight text={reply.text} query={query} />
        </span>

        <span
          aria-hidden="true"
          className={cn(
            "absolute top-3 right-3 flex size-8 items-center justify-center rounded-md border transition-colors",
            copied
              ? "border-transparent bg-[oklch(0.55_0.16_var(--h))] text-white dark:bg-[oklch(0.7_0.14_var(--h))] dark:text-[oklch(0.2_0.03_var(--h))]"
              : "bg-card text-muted-foreground group-hover/reply:text-foreground",
          )}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </span>
      </button>

      {editable && (
        <div className="flex items-center justify-end gap-1 border-t bg-muted/20 px-2 py-1.5">
          <ReplyActions reply={reply} categories={categories} />
        </div>
      )}
    </article>
  );
}
