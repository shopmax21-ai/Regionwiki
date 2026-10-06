"use client";

import { cn } from "cn";
import { Check, Copy } from "lucide-react";

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

/** Ответ выглядит как сообщение в чате: именно такое игрок и увидит в репорте. */
export function ReplyCard({ reply, categories, editable, copied, onCopy, query }: ReplyCardProps) {
  return (
    <article className="group/reply flex min-w-0 flex-col gap-1" style={hueStyle(categoryHue(reply.category))}>
      <button
        type="button"
        onClick={() => onCopy(reply)}
        aria-label={`Скопировать ответ «${reply.title}»`}
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-center justify-between gap-3 px-1">
          <span className="min-w-0 truncate font-medium text-sm">
            <Highlight text={reply.title} query={query} />
          </span>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 text-muted-foreground text-xs transition-colors group-hover/reply:text-foreground",
              copied && "text-foreground",
            )}
            aria-hidden="true"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Скопировано" : "Копировать"}
          </span>
        </span>

        <span
          className={cn(
            "h-full whitespace-pre-line break-words rounded-2xl rounded-tl-sm border px-4 py-3 text-sm leading-6 transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.995]",
            "border-[oklch(0.89_0.05_var(--h))] bg-[oklch(0.965_0.025_var(--h))]",
            "group-hover/reply:border-[oklch(0.78_0.1_var(--h))]",
            "dark:border-[oklch(0.38_0.07_var(--h))] dark:bg-[oklch(0.28_0.045_var(--h))]",
            "dark:group-hover/reply:border-[oklch(0.55_0.12_var(--h))]",
            copied &&
              "border-[oklch(0.5_0.16_var(--h))] bg-[oklch(0.5_0.16_var(--h))] text-white group-hover/reply:border-[oklch(0.5_0.16_var(--h))] dark:border-[oklch(0.6_0.15_var(--h))] dark:bg-[oklch(0.6_0.15_var(--h))] dark:text-[oklch(0.2_0.03_var(--h))] dark:group-hover/reply:border-[oklch(0.6_0.15_var(--h))]",
          )}
        >
          <Highlight text={reply.text} query={query} />
        </span>
      </button>

      {editable && (
        <div className="flex items-center justify-end gap-1">
          <ReplyActions reply={reply} categories={categories} />
        </div>
      )}
    </article>
  );
}
