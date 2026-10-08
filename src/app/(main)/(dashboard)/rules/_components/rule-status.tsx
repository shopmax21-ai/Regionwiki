import { cn } from "cn";
import { CircleAlert, CircleCheck, CircleHelp, Clock3, type LucideIcon } from "lucide-react";

import { type RuleFreshness, ruleFreshnessMeta } from "./rules-meta";

const stateStyle: Record<RuleFreshness, { icon: LucideIcon; className: string }> = {
  fresh: {
    icon: CircleCheck,
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  stale: {
    icon: Clock3,
    className: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  error: {
    icon: CircleAlert,
    className: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  unknown: {
    icon: CircleHelp,
    className: "border-border bg-muted/50 text-muted-foreground",
  },
};

/** Бейдж статуса актуальности правил: «Актуально», «Давно не проверялось», «Не удалось проверить», «Ещё не проверялось». */
export function RuleStatusBadge({ state, className }: { state: RuleFreshness; className?: string }) {
  const { icon: Icon, className: tone } = stateStyle[state];
  const meta = ruleFreshnessMeta[state];
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium text-xs whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
