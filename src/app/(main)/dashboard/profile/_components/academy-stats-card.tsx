import Link from "next/link";

import { ArrowRight, GraduationCap } from "lucide-react";

import { AttemptsTable } from "@/app/(main)/dashboard/academy/_components/attempts-table";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/academy/format";
import type { UserStats } from "@/lib/academy/store";

/** Статистика администратора по тестам Академии. Показывается в его профиле и остальной администрации. */
export function AcademyStatsCard({
  stats,
  own = true,
}: {
  stats: UserStats /** false: статистика другого администратора */;
  own?: boolean;
}) {
  const tiles = [
    { label: "Пройдено тестов", value: String(stats.attempts) },
    { label: "Сдано", value: stats.attempts > 0 ? `${stats.passed} из ${stats.attempts}` : "—" },
    { label: "Средний результат", value: stats.attempts > 0 ? `${stats.averagePercent}%` : "—" },
    { label: "Лучший результат", value: stats.attempts > 0 ? `${stats.bestPercent}%` : "—" },
  ];

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="flex-row items-start justify-between gap-3 pb-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-4" aria-hidden="true" />
            Академия
          </CardTitle>
          <CardDescription>
            {stats.lastAt
              ? `Последний тест: ${formatDateTime(stats.lastAt)}`
              : own
                ? "Вы ещё не проходили тесты."
                : "Тесты ещё не пройдены."}
          </CardDescription>
        </div>
        <Link href="/dashboard/academy" prefetch={false} className={buttonVariants({ variant: "outline", size: "sm" })}>
          К тестам
          <ArrowRight data-icon="inline-end" />
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <dl className="grid grid-cols-2 gap-3 px-6 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted/50 px-3 py-2.5">
              <dt className="truncate text-muted-foreground text-xs">{tile.label}</dt>
              <dd className="truncate font-medium text-lg tabular-nums">{tile.value}</dd>
            </div>
          ))}
        </dl>
        {stats.recent.length > 0 && (
          <div className="border-t">
            <AttemptsTable attempts={stats.recent} emptyText="" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
