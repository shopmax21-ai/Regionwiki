import { CalendarClock, Fingerprint, LogIn } from "lucide-react";

import type { UserStats } from "@/lib/academy/store";
import type { DbUser, LoginEvent } from "@/lib/auth/db";
import type { AdminGroup } from "@/lib/auth/groups";

import { AcademyStatsCard } from "./academy-stats-card";
import { IdentityCard } from "./identity-card";
import { LoginHistory } from "./login-history";
import { NotificationsCard } from "./notifications-card";
import { ProfileHeaderCard } from "./profile-header-card";
import { profileDateFormat } from "./profile-stat-tiles";
import { SecurityCard } from "./security-card";

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
    { icon: CalendarClock, label: "Первый вход", value: profileDateFormat.format(user.createdAt) },
    { icon: LogIn, label: "Входов всего", value: String(user.loginCount) },
  ];

  // Слева то, что относится к игре и работе администратора; справа аккаунт: уведомления, безопасность, входы.
  // У обычного участника левой колонки нет, тогда карточки аккаунта занимают всю ширину в две колонки.
  const hasMain = group !== null || academy !== null;

  const account = (
    <>
      {canReceiveRequests && <NotificationsCard initialEnabled={user.notifyRequests} />}
      <SecurityCard />
      <LoginHistory
        rows={events.map((event) => ({
          id: event.id,
          active: event.id === activeLoginId,
          device: deviceName(event.userAgent),
          when: profileDateFormat.format(event.createdAt),
          ip: event.ip && event.ip !== "unknown" ? event.ip : null,
        }))}
      />
    </>
  );

  return (
    <div className="flex w-full flex-col gap-4 md:gap-6">
      <ProfileHeaderCard
        person={person}
        status={user.status}
        username={user.username}
        background={user.profileBackground}
        stats={stats}
        editable
      />

      {hasMain ? (
        <div className="grid items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="flex min-w-0 flex-col gap-4 md:gap-6">
            {group && <IdentityCard person={person} mode="self" />}
            {academy && <AcademyStatsCard stats={academy} />}
          </div>
          <div className="flex min-w-0 flex-col gap-4 md:gap-6">{account}</div>
        </div>
      ) : (
        <div className="grid items-start gap-4 md:gap-6 lg:grid-cols-2">{account}</div>
      )}
    </div>
  );
}
