import { ShieldCheck } from "lucide-react";

import { PersonName } from "@/components/person-name";
import { RoleBadge } from "@/components/role-icon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Person } from "@/lib/auth/person";
import type { AccessStatus } from "@/lib/auth/session";

import { ProfileAvatar } from "./profile-avatar";
import { ProfileBackgroundControl } from "./profile-background-control";
import { type ProfileStat, ProfileStatTiles } from "./profile-stat-tiles";

export const statusLabel = {
  pending: "Ожидает одобрения",
  approved: "Доступ открыт",
  rejected: "Доступ отклонён",
} as const;

type ProfileHeaderCardProps = {
  person: Person;
  status: AccessStatus;
  username: string | null;
  /** Адрес загруженного фона или null */
  background: string | null;
  /** Telegram ID человека, чей это профиль, если он не совпадает с текущим посетителем: нужен для аватара */
  avatarUserId?: string;
  /** Показывать кнопки загрузки фона: только в своём профиле */
  editable?: boolean;
  /** Цифры справа от имени */
  stats: ProfileStat[];
};

/**
 * Шапка профиля: широкий баннер с фоном, поверх его нижнего края аватар, рядом имя, роль и цифры.
 * Общая для своего профиля и профиля другого администратора.
 */
export function ProfileHeaderCard({
  person,
  status,
  username,
  background,
  avatarUserId,
  editable = false,
  stats,
}: ProfileHeaderCardProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="relative h-36 bg-gradient-to-br from-primary/30 via-primary/10 to-muted md:h-48">
        {background && (
          <>
            {/* biome-ignore lint/performance/noImgElement: картинка из своего хранилища, размер неизвестен */}
            <img src={background} alt="" className="absolute inset-0 size-full object-cover" />
            {/* Нижний край баннера переходит в цвет карточки, чтобы аватар и текст не терялись на фоне */}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-card/70 via-transparent to-transparent" />
          </>
        )}

        {editable && <ProfileBackgroundControl hasBackground={background !== null} />}

        {status === "approved" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={statusLabel.approved}
                className="absolute top-3 right-3 z-20 flex size-8 items-center justify-center rounded-md border border-green-500/30 bg-background/70 text-green-600 outline-none backdrop-blur-sm transition hover:bg-background/90 focus-visible:ring-2 focus-visible:ring-green-500/50 dark:text-green-400"
              >
                <ShieldCheck className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{statusLabel.approved}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex flex-col gap-5 px-5 pb-5 md:px-8 md:pb-6 xl:flex-row xl:items-end xl:justify-between xl:gap-8">
        <div className="-mt-12 flex min-w-0 flex-wrap items-end gap-x-5 gap-y-2 md:-mt-16">
          <ProfileAvatar
            name={person.name}
            userId={avatarUserId}
            className="size-24 rounded-2xl shadow-sm ring-4 ring-card md:size-32"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2 pb-1">
            <h1 className="min-w-0 truncate font-semibold text-2xl tracking-tight md:text-3xl">
              <PersonName person={person} showRole={false} className="[&>span.truncate]:font-semibold" />
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground text-sm">
              <RoleBadge group={person.group} />
              <span className="truncate">
                {person.nickname ? `${person.name} · ` : ""}
                {username ? `@${username}` : "Без username"}
              </span>
              {status !== "approved" && <Badge variant="destructive">{statusLabel[status]}</Badge>}
            </div>
          </div>
        </div>

        <ProfileStatTiles stats={stats} />
      </div>
    </Card>
  );
}
