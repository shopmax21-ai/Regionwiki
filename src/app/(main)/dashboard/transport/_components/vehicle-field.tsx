import type { ReactNode } from "react";

import { cn } from "cn";

import { Label } from "@/components/ui/label";

/** Идентификатор поля формы транспорта по его ключу. По нему подпись связана с полем, а при ошибке форма прокручивается к полю. */
export const fieldId = (field: string) => `vf-${field}`;

type FieldProps = {
  /** Ключ поля (см. fieldId) */
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
};

/** Подпись, поле, подсказка и ошибка под ним. Ошибка заменяет подсказку и читается скринридером. */
export function Field({ id, label, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={fieldId(id)}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex flex-col gap-0.5">
        <h3 className="font-semibold text-sm">{title}</h3>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      {children}
    </section>
  );
}

type ChipProps = {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
};

/** Кнопка-«чип» для выбора одного значения из короткого списка или включения особенности. */
export function Chip({ pressed, onClick, children, disabled }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 [&_svg]:size-3.5",
        pressed
          ? "border-primary bg-primary/10 font-medium text-foreground"
          : "border-input text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
