import Link from "next/link";

import { ArrowLeft, CalendarClock, Clock, LogIn } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { UserStats } from "@/lib/academy/store";
import { type DbUser, toPerson } from "@/lib/auth/db";
import type { AdminGroup } from "@/lib/auth/groups";

import { AcademyStatsCard } from "./academy-stats-card";
import { IdentityCard } from "./identity-card";
import { ProfileHeaderCard } from "./profile-header-card";
import { profileDateFormat } from "./profile-stat-tiles";

/**
 * Профиль другого администратора, как его видит остальная администрация. Только чтение: история входов, адреса и
 * устройства, настройки уведомлений и безопасности остаются личными и здесь не показываются.
 */
export function StaffProfileView({
  user,
  group,
  academy,
  canEditIdentity,
}: {
  user: DbUser;
  group: AdminGroup;
  /** Статистика тестов Академии; null, если её не удалось загрузить */
  academy: UserStats | null;
  /** Посетитель стоит выше по группе: может исправить Никнейм и Statik ID этого администратора */
  canEditIdentity: boolean;
}) {
  const person = toPerson(user);
  const stats = [
    { icon: CalendarClock, label: "Первый вход", value: profileDateFormat.format(user.createdAt) },
    {
      icon: Clock,
      label: "Последний вход",
      value: user.lastLoginAt ? profileDateFormat.format(user.lastLoginAt) : "—",
    },
    { icon: LogIn, label: "Входов всего", value: String(user.loginCount) },
  ];

  return (
    <div className="flex w-full flex-col gap-4 md:gap-6">
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
        stats={stats}
      />

      {/* Статистика Академии занимает основную часть, форма исправления данных стоит рядом справа */}
      <div
        className={
          canEditIdentity && academy
            ? "grid items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]"
            : "flex flex-col gap-4 md:gap-6"
        }
      >
        {academy && <AcademyStatsCard stats={academy} own={false} />}
        {canEditIdentity && <IdentityCard person={person} mode="staff" />}
      </div>
    </div>
  );
}
