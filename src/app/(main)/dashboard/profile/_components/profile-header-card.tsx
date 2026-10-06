import { ShieldCheck } from "lucide-react";

import { PersonName } from "@/components/person-name";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

/** Фон виден у левого края и плавно исчезает к правому. */
const FADE = "linear-gradient(to right, #000 0%, rgba(0, 0, 0, 0.75) 35%, transparent 100%)";

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

/** Блок профиля: аватар, имя, роль и фон. Общий для своего профиля и профиля другого администратора. */
export function ProfileHeaderCard({
  person,
  status,
  username,
  background,
  avatarUserId,
  editable = false,
}: ProfileHeaderCardProps) {
  return (
    <Card className="relative">
      {background && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ maskImage: FADE, WebkitMaskImage: FADE }}
        >
          {/* biome-ignore lint/performance/noImgElement: картинка из своего хранилища, размер неизвестен */}
          <img src={background} alt="" className="size-full object-cover" />
          {/* Лёгкая подложка под текстом: светлая в светлой теме и тёмная в тёмной */}
          <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-background/20 to-transparent" />
        </div>
      )}

      {editable && <ProfileBackgroundControl hasBackground={background !== null} />}

      {status === "approved" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={statusLabel.approved}
              className="absolute top-3 right-3 z-20 flex size-7 items-center justify-center rounded-md bg-green-500/15 text-green-600 outline-none transition hover:bg-green-500/25 focus-visible:ring-2 focus-visible:ring-green-500/50 dark:text-green-400"
            >
              <ShieldCheck className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{statusLabel.approved}</TooltipContent>
        </Tooltip>
      )}

      <CardContent className="relative z-10 flex flex-wrap items-center gap-4">
        <ProfileAvatar name={person.name} userId={avatarUserId} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold text-xl">
            <PersonName person={person} className="[&>span.truncate]:font-semibold" />
          </h1>
          <p className="truncate text-muted-foreground text-sm">
            {person.nickname ? `${person.name} · ` : ""}
            {username ? `@${username}` : "Без username"}
          </p>
        </div>
        {status !== "approved" && <Badge variant="destructive">{statusLabel[status]}</Badge>}
      </CardContent>
    </Card>
  );
}
