import { cn } from "cn";
import type { LucideIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type StatusTone = "green" | "red" | "amber" | "blue" | "muted";

const TONES: Record<StatusTone, string> = {
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  red: "bg-destructive/10 text-destructive",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  muted: "bg-muted text-muted-foreground",
};

/** Статус в таблице: компактная иконка, а текст статуса показывается в подсказке. */
export function StatusIcon({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: StatusTone }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={label}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: нужен фокус с клавиатуры, чтобы показать подсказку
          tabIndex={0}
          className={cn(
            "inline-grid size-7 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            TONES[tone],
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
