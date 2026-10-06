import { CalendarClock, Fingerprint, LogIn, ShieldCheck } from "lucide-react";

import { PersonName } from "@/components/person-name";
import { RoleBadge } from "@/components/role-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UserStats } from "@/lib/academy/store";
import type { DbUser, LoginEvent } from "@/lib/auth/db";
import type { AdminGroup } from "@/lib/auth/groups";

import { AcademyStatsCard } from "./academy-stats-card";
import { IdentityCard } from "./identity-card";
import { LoginHistory } from "./login-history";
import { NotificationsCard } from "./notifications-card";
import { ProfileAvatar } from "./profile-avatar";
import { SecurityCard } from "./security-card";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" });

const statusLabel = { pending: "Ожидает одобрения", approved: "Доступ открыт", rejected: "Доступ отклонён" } as const;

/** Короткое название устройства из User-Agent: хватает, чтобы узнать свой вход. */
function deviceName(userAgent: string | null): string {
  if (!userAgent) return "Неизвестное устройство";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad/.test(userAgent)
        ? "iOS"
        : /Mac OS/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Устройство";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "браузер";
  return `${browser} · ${os}`;
}

export function ProfileView({
  user,
  events,
  activeLoginId,
  canReceiveRequests,
  academy,
  group,
}: {
  user: DbUser;
  /** Группа администратора с учётом TELEGRAM_ADMIN_IDS; у обычного участника null */
  group: AdminGroup | null;
  events: LoginEvent[];
  /** Запись входа текущей сессии */
  activeLoginId: string | null;
  canReceiveRequests: boolean;
  /** Статистика тестов Академии; только у администраторов */
  academy: UserStats | null;
}) {
  const person = { id: user.telegramId, name: user.name, nickname: user.nickname, staticId: user.staticId, group };
  const stats = [
    { icon: Fingerprint, label: "Telegram ID", value: user.telegramId },
    { icon: CalendarClock, label: "Первый вход", value: dateFormat.format(user.createdAt) },
    { icon: LogIn, label: "Входов всего", value: String(user.loginCount) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 md:gap-6">
      <Card className="relative">
        {user.status === "approved" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={statusLabel.approved}
                className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md bg-green-500/15 text-green-600 outline-none transition hover:bg-green-500/25 focus-visible:ring-2 focus-visible:ring-green-500/50 dark:text-green-400"
              >
                <ShieldCheck className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{statusLabel.approved}</TooltipContent>
          </Tooltip>
        )}
        <CardContent className="flex flex-wrap items-center gap-4">
          <ProfileAvatar name={user.name} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold text-xl">
              <PersonName person={person} showRole={false} className="[&>span:nth-child(1)]:font-semibold" />
            </h1>
            <p className="truncate text-muted-foreground text-sm">
              {user.nickname ? `${user.name} · ` : ""}
              {user.username ? `@${user.username}` : "Без username"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RoleBadge group={group} />
            {user.status !== "approved" && <Badge variant="destructive">{statusLabel[user.status]}</Badge>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3 md:gap-6">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Icon className="size-3.5" />
                {label}
              </span>
              <span className="truncate font-medium text-sm tabular-nums">{value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {group && <IdentityCard person={person} />}

      {academy && <AcademyStatsCard stats={academy} />}

      {canReceiveRequests && <NotificationsCard initialEnabled={user.notifyRequests} />}

      <SecurityCard />

      <LoginHistory
        rows={events.map((event) => ({
          id: event.id,
          active: event.id === activeLoginId,
          device: deviceName(event.userAgent),
          when: dateFormat.format(event.createdAt),
          ip: event.ip && event.ip !== "unknown" ? event.ip : null,
        }))}
      />
    </div>
  );
}
