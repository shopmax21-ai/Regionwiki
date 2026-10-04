"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "cn";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";

import type { QuickReply } from "../_data/replies";
import { copyText } from "./copy-text";
import { ReplyActions } from "./reply-actions";

type ReplyCardProps = {
  reply: QuickReply;
  categories: readonly string[];
  /** Показывать кнопки изменения и удаления */
  editable: boolean;
};

export function ReplyCard({ reply, categories, editable }: ReplyCardProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    const ok = await copyText(reply.text);
    if (!ok) {
      toast.error("Не удалось скопировать, выделите текст вручную");
      return;
    }
    toast.success("Ответ скопирован");
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Card
      className={cn(
        "group/reply h-full gap-0 py-0 transition-shadow hover:ring-primary/50",
        copied && "ring-2 ring-primary/70 hover:ring-primary/70",
      )}
    >
      <button
        type="button"
        onClick={copy}
        aria-label={`Скопировать ответ «${reply.title}»`}
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2 rounded-xl p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="font-semibold tracking-tight">{reply.title}</span>
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover/reply:text-foreground",
              copied && "bg-primary text-primary-foreground group-hover/reply:text-primary-foreground",
            )}
            aria-hidden="true"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </span>
        </span>
        <span className="whitespace-pre-line break-words text-muted-foreground text-sm">{reply.text}</span>
      </button>

      {editable && (
        <div className="flex items-center justify-end gap-1 border-t px-2 py-1.5">
          <ReplyActions reply={reply} categories={categories} />
        </div>
      )}
    </Card>
  );
}
