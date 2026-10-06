import { cn } from "cn";
import { IdCard } from "lucide-react";

import type { Person } from "@/lib/auth/person";
import { personLabel } from "@/lib/auth/person";

import { RoleIcon } from "./role-icon";

/**
 * Единое отображение человека на сайте: «(иконка роли) Никнейм (иконка ID) Статик».
 * Если Никнейм не указан, вместо него имя из Telegram; если не указан Статик, его часть не показывается;
 * у обычного участника (не администратора) иконки роли нет.
 */
export function PersonName({
  person,
  className,
  showRole = true,
}: {
  person: Person;
  className?: string;
  /** Иконка роли слева. Выключается там, где роль уже показана рядом отдельным бейджем. */
  showRole?: boolean;
}) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle", className)}>
      {showRole && person.group && <RoleIcon group={person.group} />}
      <span className="truncate font-medium">{personLabel(person)}</span>
      {person.staticId && (
        <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground tabular-nums">
          <IdCard className="size-3.5" role="img" aria-label="Statik ID" />
          {person.staticId}
        </span>
      )}
    </span>
  );
}
