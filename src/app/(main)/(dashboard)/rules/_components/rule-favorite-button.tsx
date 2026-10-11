import { cn } from "cn";
import { Star } from "lucide-react";

/** Звёздочка «в избранное» для пункта правил. Цвета те же, что у избранных быстрых ответов. */
export function RuleFavoriteButton({
  active,
  reference,
  onToggle,
  className,
}: {
  active: boolean;
  /** Номер пункта для подписи, например «ОП 1.3» */
  reference: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? `Убрать ${reference} из избранного` : `Добавить ${reference} в избранное`}
      title={active ? "Убрать из избранного" : "В избранное"}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
        active && "border-amber-400/60 text-amber-500 hover:text-amber-500",
        className,
      )}
    >
      <Star aria-hidden="true" className={cn("size-4", active && "fill-current")} />
    </button>
  );
}
