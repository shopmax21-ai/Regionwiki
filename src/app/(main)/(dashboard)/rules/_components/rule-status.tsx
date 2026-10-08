import { cn } from "cn";
import { CircleAlert, CircleCheck, CircleHelp, Clock3, type LucideIcon, ShieldCheck } from "lucide-react";

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

/** Оформление блока статуса: цвет фона, обводки и текста для каждого состояния. */
const blockStyle: Record<RuleFreshness, string> = {
  fresh: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/70 dark:text-emerald-300",
  stale: "border-amber-500 bg-amber-500/10 text-amber-700 dark:border-amber-400/70 dark:text-amber-300",
  error: "border-red-500 bg-red-500/10 text-red-700 dark:border-red-400/70 dark:text-red-300",
  unknown: "border-border bg-muted/50 text-muted-foreground",
};

/** Иконка на фоне блока: у «Актуально» щит с галочкой, у остальных состояний та же, что в бейдже. */
const blockIcon: Record<RuleFreshness, LucideIcon> = {
  fresh: ShieldCheck,
  stale: Clock3,
  error: CircleAlert,
  unknown: CircleHelp,
};

/**
 * Блок статуса актуальности в правом верхнем углу раздела правил — «водяной знак»:
 * лёгкий полупрозрачный цветной фон, крупная блёклая иконка справа, уходящая за край блока.
 * Показывает любое состояние (актуально, давно не проверялось, ошибка, ещё не проверялось)
 * и время последней проверки — других мест со статусом на странице нет.
 */
export function RuleStatusBlock({
  state,
  lastChecked,
  className,
}: {
  state: RuleFreshness;
  /** «04.10.2026, 11:00 МСК» или null, если проверка ещё не выполнялась */
  lastChecked: string | null;
  className?: string;
}) {
  const Icon = blockIcon[state];
  const meta = ruleFreshnessMeta[state];
  return (
    <div
      title={meta.hint}
      className={cn(
        "relative flex shrink-0 select-none flex-col justify-center gap-0.5 overflow-hidden rounded-xl border py-2 pr-14 pl-4 opacity-90",
        blockStyle[state],
        className,
      )}
    >
      <Icon
        className="pointer-events-none absolute top-1/2 -right-4 size-16 -translate-y-1/2 -rotate-12 opacity-25"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <span className="relative font-semibold text-sm leading-tight">{meta.label}</span>
      <span className="relative text-xs leading-tight opacity-80">
        {lastChecked ? `Проверено ${lastChecked}` : "Проверка ещё не выполнялась"}
      </span>
    </div>
  );
}
