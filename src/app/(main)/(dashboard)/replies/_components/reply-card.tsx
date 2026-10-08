"use client";

import { cn } from "cn";
import { Check, ChevronDown, Copy, MessageSquareText, Star } from "lucide-react";

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
  /** Ответ в избранном */
  favorite: boolean;
  onToggleFavorite: (reply: QuickReply) => void;
  /** Свёрнутая карточка: только название, текст скрыт */
  collapsed: boolean;
  onToggleCollapsed: (reply: QuickReply) => void;
};

const iconButton =
  "flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

/** Блок с готовым ответом: цвет категории в значке и рамке, весь блок нажимается и копирует текст. */
export function ReplyCard({
  reply,
  categories,
  editable,
  copied,
  onCopy,
  query,
  favorite,
  onToggleFavorite,
  collapsed,
  onToggleCollapsed,
}: ReplyCardProps) {
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
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer flex-col text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
          collapsed ? "gap-0 p-3" : "gap-3 p-4",
        )}
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.94_0.045_var(--h))] text-[oklch(0.45_0.14_var(--h))] dark:bg-[oklch(0.32_0.07_var(--h))] dark:text-[oklch(0.85_0.1_var(--h))]"
          >
            <MessageSquareText className="size-4.5" />
          </span>
          <span className={cn("min-w-0 flex-1 font-semibold leading-snug tracking-tight", collapsed ? "truncate pr-28" : "pr-28")}>
            <Highlight text={reply.title} query={query} />
          </span>
        </span>

        {!collapsed && (
          <span className="whitespace-pre-line break-words rounded-xl bg-muted/50 px-3.5 py-3 text-foreground/90 text-sm leading-6">
            <Highlight text={reply.text} query={query} />
          </span>
        )}
      </button>

      {/* Кнопки лежат поверх карточки, а не внутри кнопки копирования: вложенные кнопки в HTML недопустимы */}
      <div
        className={cn("absolute right-3 flex items-center gap-1.5", collapsed ? "top-1/2 -translate-y-1/2" : "top-3")}
      >
        <button
          type="button"
          onClick={() => onToggleFavorite(reply)}
          aria-pressed={favorite}
          aria-label={favorite ? `Убрать «${reply.title}» из избранного` : `Добавить «${reply.title}» в избранное`}
          title={favorite ? "Убрать из избранного" : "В избранное"}
          className={cn(iconButton, favorite && "border-amber-400/60 text-amber-500 hover:text-amber-500")}
        >
          <Star className={cn("size-4", favorite && "fill-current")} />
        </button>
        <button
          type="button"
          onClick={() => onToggleCollapsed(reply)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Развернуть ответ «${reply.title}»` : `Свернуть ответ «${reply.title}»`}
          title={collapsed ? "Развернуть" : "Свернуть"}
          className={iconButton}
        >
          <ChevronDown className={cn("size-4 transition-transform", !collapsed && "rotate-180")} />
        </button>
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none flex size-8 items-center justify-center rounded-full border transition-colors",
            copied
              ? "border-transparent bg-[oklch(0.55_0.16_var(--h))] text-white dark:bg-[oklch(0.7_0.14_var(--h))] dark:text-[oklch(0.2_0.03_var(--h))]"
              : "bg-card text-muted-foreground group-hover/reply:text-foreground",
          )}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </span>
      </div>

      {editable && !collapsed && (
        <div className="flex items-center justify-end gap-1 border-t bg-muted/20 px-2 py-1.5">
          <ReplyActions reply={reply} categories={categories} />
        </div>
      )}
    </article>
  );
}
