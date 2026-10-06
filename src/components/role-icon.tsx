import { cn } from "cn";
import { Crown, HandHelping, type LucideIcon, Shield, ShieldCheck, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { type AdminGroup, groupInfo } from "@/lib/auth/groups";

type IconComponent = LucideIcon;

/** Иконка и цвет бейджа для каждой роли. Классы записаны целиком, чтобы Tailwind их увидел. */
const GROUP_BADGES: Record<AdminGroup, { icon: IconComponent; text: string; badge: string }> = {
  helper: {
    icon: HandHelping,
    text: "text-emerald-600 dark:text-emerald-400",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  junior: {
    icon: Shield,
    text: "text-sky-600 dark:text-sky-400",
    badge: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  admin: {
    icon: ShieldCheck,
    text: "text-violet-600 dark:text-violet-400",
    badge: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  chief: {
    icon: Crown,
    text: "text-amber-500 dark:text-amber-400",
    badge: "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
};

/** Иконка роли как компонент: для пунктов меню и кнопок, где нужна именно иконка без подписи. */
export const groupIconComponent = (group: AdminGroup): IconComponent => GROUP_BADGES[group].icon;

const MEMBER_BADGE = {
  icon: User,
  text: "text-muted-foreground",
  badge: "text-muted-foreground",
} as const;

const MEMBER_LABEL = "Участник";

/** Иконка роли для подписи рядом с именем. Название роли доступно по наведению и для скринридеров. */
export function RoleIcon({ group, className }: { group: AdminGroup | null; className?: string }) {
  const { icon: Icon, text } = group ? GROUP_BADGES[group] : MEMBER_BADGE;
  const label = group ? groupInfo[group].label : MEMBER_LABEL;
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex shrink-0">
      <Icon className={cn("size-4", text, className)} aria-hidden="true" />
    </span>
  );
}

/** Бейдж роли: цветная иконка и название. Для обычного участника group = null. */
export function RoleBadge({ group, className }: { group: AdminGroup | null; className?: string }) {
  const { icon: Icon, badge } = group ? GROUP_BADGES[group] : MEMBER_BADGE;
  return (
    <Badge variant="outline" className={cn(badge, className)}>
      <Icon data-icon="inline-start" aria-hidden="true" />
      {group ? groupInfo[group].label : MEMBER_LABEL}
    </Badge>
  );
}
