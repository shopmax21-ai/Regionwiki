import { ShieldCheck } from "lucide-react";

import { RegionMarkOutline } from "@/app/(main)/auth/_components/region-mark-outline";
import { PersonName } from "@/components/person-name";
import { RoleBadge } from "@/components/role-icon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Person } from "@/lib/auth/person";
import type { AccessStatus } from "@/lib/auth/session";

import { ProfileAvatar } from "./profile-avatar";
import { ProfileBackgroundControl } from "./profile-background-control";

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
};

/** Обложка: загруженный фон или фирменный узор из «R» со свечением. Снизу плавно переходит в цвет карточки. */
function Cover({ background }: { background: string | null }) {
  return (
    <div aria-hidden="true" className="pointer-events-none relative h-36 overflow-hidden sm:h-48">
      {background ? (
        // biome-ignore lint/performance/noImgElement: картинка из своего хранилища, размер неизвестен
        <img src={background} alt="" className="size-full object-cover" />
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/5 to-transparent" />
          <svg className="absolute inset-0 size-full text-foreground [mask-image:linear-gradient(to_right,transparent,black)]">
            <defs>
              <pattern id="profile-cover-pattern" width="98" height="64" patternUnits="userSpaceOnUse">
                <g fill="currentColor" fillOpacity="0.06" fontSize="20" fontStyle="italic" fontWeight="800">
                  <text x="0" y="24">
                    R
                  </text>
                  <text x="49" y="24">
                    R
                  </text>
                  <text x="24" y="56">
                    R
                  </text>
                  <text x="73" y="56">
                    R
                  </text>
                </g>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#profile-cover-pattern)" />
          </svg>
          <div className="absolute -right-6 -bottom-16 hidden opacity-70 sm:block">
            <div className="absolute inset-8 rounded-md bg-primary/25 blur-3xl" />
            <RegionMarkOutline id="rmo-profile" className="relative w-56" />
          </div>
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card to-transparent" />
    </div>
  );
}

/** Шапка профиля: обложка, крупный аватар, имя, группа и username. Общая для своего профиля и профиля другого администратора. */
export function ProfileHeaderCard({
  person,
  status,
  username,
  background,
  avatarUserId,
  editable = false,
}: ProfileHeaderCardProps) {
  return (
    <Card className="relative gap-0 overflow-hidden py-0">
      <Cover background={background} />

      {editable && <ProfileBackgroundControl hasBackground={background !== null} />}

      {status === "approved" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={statusLabel.approved}
              className="absolute top-3 right-3 z-20 flex size-7 items-center justify-center rounded-md bg-green-500/15 text-green-600 outline-none backdrop-blur-sm transition hover:bg-green-500/25 focus-visible:ring-2 focus-visible:ring-green-500/50 dark:text-green-400"
            >
              <ShieldCheck className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{statusLabel.approved}</TooltipContent>
        </Tooltip>
      )}

      <div className="relative z-10 -mt-14 flex flex-col gap-3 px-5 pb-6 sm:-mt-16 sm:flex-row sm:items-end sm:gap-5 sm:px-6">
        <ProfileAvatar
          name={person.nickname ?? person.name}
          userId={avatarUserId}
          className="size-24 rounded-2xl text-2xl shadow-lg ring-4 ring-card after:rounded-2xl sm:size-28 [&_*]:rounded-2xl"
        />
        <div className="w-full min-w-0 flex-1 pb-1 sm:w-auto">
          <h1 className="truncate font-bold text-2xl sm:text-3xl">
            <PersonName person={person} showRole={false} className="[&>span.truncate]:font-bold" />
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground text-sm">
            <RoleBadge group={person.group} />
            {status !== "approved" && <Badge variant="destructive">{statusLabel[status]}</Badge>}
            <span className="truncate">
              {person.nickname ? `${person.name} · ` : ""}
              {username ? `@${username}` : "Без username"}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
