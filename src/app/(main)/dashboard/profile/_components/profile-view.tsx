import { CalendarClock, Fingerprint, LogIn, Monitor } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserStats } from "@/lib/academy/store";
import type { DbUser, LoginEvent } from "@/lib/auth/db";

import { AcademyStatsCard } from "./academy-stats-card";
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
  canReceiveRequests,
  academy,
}: {
  user: DbUser;
  events: LoginEvent[];
  canReceiveRequests: boolean;
  /** Статистика тестов Академии; только у администраторов */
  academy: UserStats | null;
}) {
  const stats = [
    { icon: Fingerprint, label: "Telegram ID", value: user.telegramId },
    { icon: CalendarClock, label: "Первый вход", value: dateFormat.format(user.createdAt) },
    { icon: LogIn, label: "Входов всего", value: String(user.loginCount) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 md:gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <ProfileAvatar name={user.name} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold text-xl">{user.name}</h1>
            <p className="truncate text-muted-foreground text-sm">
              {user.username ? `@${user.username}` : "Без username"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
              {user.role === "admin" ? "Администратор" : "Участник"}
            </Badge>
            <Badge variant={user.status === "approved" ? "outline" : "destructive"}>{statusLabel[user.status]}</Badge>
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

      {academy && <AcademyStatsCard stats={academy} />}

      {canReceiveRequests && <NotificationsCard initialEnabled={user.notifyRequests} />}

      <SecurityCard />

      <Card>
        <CardHeader>
          <CardTitle>Последние входы</CardTitle>
          <CardDescription>Если здесь есть вход, которого вы не совершали, сообщите администратору.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {events.length === 0 && <p className="text-muted-foreground text-sm">Записей пока нет.</p>}
          {events.map((event) => (
            <div
              key={event.createdAt.toISOString()}
              className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex items-center gap-2 text-sm">
                <Monitor className="size-4 text-muted-foreground" />
                {deviceName(event.userAgent)}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {dateFormat.format(event.createdAt)}
                {event.ip && event.ip !== "unknown" ? ` · ${event.ip}` : ""}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
