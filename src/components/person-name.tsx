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
      {avatar && person.group && person.id && <PersonAvatar id={person.id} name={personLabel(person)} className="size-7 rounded-lg text-[0.65rem]" />}
      {showRole && person.group && <RoleIcon group={person.group} />}
      <span className="truncate font-medium">{personLabel(person)}</span>
      {person.staticId && (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Заметный Static ID: без рамки и подложки, крупнее и курсивом */}
            <span
              role="img"
              aria-label={`Static ID ${person.staticId}`}
              className="shrink-0 cursor-default font-mono font-semibold text-[1em] text-foreground/90 italic tabular-nums"
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
