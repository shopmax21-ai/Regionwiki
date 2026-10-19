import { cn } from "cn";
import type * as React from "react";

export function AdminPageHeader({
  section,
  title,
  description,
  actions,
  className,
}: {
  /** Небольшая надпись над заголовком, например «Обучение». */
  section: string;
  title: string;
  description?: string;
  /** Кнопки или ссылки справа от заголовка; на мобильных переносятся под него. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">{section}</p>
        <h1 className="mt-1 break-words font-semibold text-2xl tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
