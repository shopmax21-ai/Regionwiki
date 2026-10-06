import Link from "next/link";

import { ArrowLeft, CalendarClock, Clock, Fingerprint, LogIn } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { UserStats } from "@/lib/academy/store";
import { type DbUser, toPerson } from "@/lib/auth/db";
import type { AdminGroup } from "@/lib/auth/groups";

import { AcademyStatsCard } from "./academy-stats-card";
import { ProfileHeaderCard } from "./profile-header-card";
import { ProfileStatTiles, profileDateFormat } from "./profile-stat-tiles";

/**
 * Профиль другого администратора, как его видит остальная администрация. Только чтение: история входов, адреса и
 * устройства, настройки уведомлений и безопасности остаются личными и здесь не показываются.
 */
export function StaffProfileView({
  user,
  group,
  academy,
}: {
  user: DbUser;
  group: AdminGroup;
  /** Статистика тестов Академии; null, если её не удалось загрузить */
  academy: UserStats | null;
}) {
  const person = toPerson(user);
  const stats = [
    { icon: Fingerprint, label: "Telegram ID", value: user.telegramId },
    { icon: CalendarClock, label: "Первый вход", value: profileDateFormat.format(user.createdAt) },
    {
      icon: Clock,
      label: "Последний вход",
      value: user.lastLoginAt ? profileDateFormat.format(user.lastLoginAt) : "—",
    },
    { icon: LogIn, label: "Входов всего", value: String(user.loginCount) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 md:gap-6">
      <div>
        <Link href="/dashboard/staff" prefetch={false} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft data-icon="inline-start" />К администрации
        </Link>
      </div>

      <ProfileHeaderCard
        person={person}
        status={user.status}
        username={user.username}
        background={user.profileBackground}
        avatarUserId={user.telegramId}
      />

      <ProfileStatTiles stats={stats} />

      {academy && <AcademyStatsCard stats={academy} own={false} />}
    </div>
  );
}
