import { cn } from "cn";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Person } from "@/lib/auth/person";
import { personLabel } from "@/lib/auth/person";

import { PersonAvatar } from "./person-avatar";
import { RoleIcon } from "./role-icon";

/**
 * Единое отображение человека на сайте: «(иконка роли) Никнейм #Статик».
 * Если Никнейм не указан, вместо него имя из Telegram; если не указан Статик, его часть не показывается;
 * у обычного участника (не администратора) иконки роли нет.
 */
export function PersonName({
  person,
  className,
  showRole = true,
  avatar = false,
}: {
  person: Person;
  className?: string;
  /** Иконка роли слева. Выключается там, где роль уже показана рядом отдельным бейджем. */
  showRole?: boolean;
  /** Аватар слева. Показывается только у администраторов: фото обычных участников сервер не отдаёт. Нужен в таблицах. */
  avatar?: boolean;
}) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle", className)}>
      {avatar && person.group && person.id && <PersonAvatar id={person.id} name={person.name} />}
      {showRole && person.group && <RoleIcon group={person.group} />}
      <span className="truncate font-medium">{personLabel(person)}</span>
      {person.staticId && (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Тихая приписка: мельче и бледнее имени, без иконки и рамки */}
            <span
              role="img"
              aria-label={`Static ID ${person.staticId}`}
              className="shrink-0 cursor-default font-normal text-[0.85em] text-muted-foreground/70 tabular-nums"
            >
              #{person.staticId}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">Static ID</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
