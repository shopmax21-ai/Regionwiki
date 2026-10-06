import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft, X } from "lucide-react";
import type { Metadata } from "next";

import { PersonName } from "@/components/person-name";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/academy/format";
import { getOverview, listAttempts } from "@/lib/academy/store";
import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { personLabel } from "@/lib/auth/person";

import { AttemptsTable } from "../_components/attempts-table";

export const metadata: Metadata = {
  title: "Результаты тестов | Академия",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ user?: string | string[]; test?: string | string[] }>;

const single = (value: string | string[] | undefined) => {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length <= 64 ? raw : undefined;
};

const href = (params: { user?: string; test?: string }) => {
  const query = new URLSearchParams();
  if (params.user) query.set("user", params.user);
  if (params.test) query.set("test", params.test);
  const text = query.toString();
  return `/dashboard/academy/results${text ? `?${text}` : ""}`;
};

/** Раздел для Гл.Администраторов: результаты всех администраторов с правильностью ответов и разбором. */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  if (!getAuthConfig()) redirect("/dashboard");
  if (!(await getAdmin("academy.results"))) redirect("/unauthorized");

  const params = await searchParams;
  const userId = single(params.user);
  const testId = single(params.test);

  const [overview, attempts] = await Promise.all([getOverview(), listAttempts({ userId, testId, limit: 200 })]);

  const totalAttempts = overview.admins.reduce((sum, row) => sum + row.attempts, 0);
  const totalPassed = overview.admins.reduce((sum, row) => sum + row.passed, 0);
  const average =
    totalAttempts === 0
      ? 0
      : Math.round(overview.admins.reduce((sum, row) => sum + row.averagePercent * row.attempts, 0) / totalAttempts);
  const passRate = totalAttempts === 0 ? 0 : Math.round((totalPassed / totalAttempts) * 100);

  const activeUser = overview.admins.find((row) => row.userId === userId);
  const activeTest = overview.tests.find((row) => row.testId === testId);

  const kpis = [
    { title: "Всего попыток", value: String(totalAttempts), note: `${overview.admins.length} админ. проходили тесты` },
    { title: "Средний результат", value: totalAttempts > 0 ? `${average}%` : "—", note: "по всем попыткам" },
    {
      title: "Доля сдавших",
      value: totalAttempts > 0 ? `${passRate}%` : "—",
      note: `${totalPassed} из ${totalAttempts}`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-xl">Результаты тестов</h1>
          <p className="text-muted-foreground text-sm">
            Правильность ответов и подробный разбор по каждому пройденному тесту. Раздел виден только Главным
            администраторам.
          </p>
        </div>
        <Link href="/dashboard/academy" prefetch={false} className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft data-icon="inline-start" />К тестам
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader>
              <CardTitle className="text-sm">{kpi.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl tabular-nums tracking-tight">{kpi.value}</span>
              <p className="text-muted-foreground text-xs">{kpi.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Администраторы</CardTitle>
            <CardDescription>Нажмите на имя, чтобы увидеть все его попытки.</CardDescription>
          </CardHeader>
          {overview.admins.length === 0 ? (
            <p className="px-4 py-6 text-center text-muted-foreground text-sm">Тесты ещё никто не проходил.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Администратор</TableHead>
                    <TableHead className="text-right">Попыток</TableHead>
                    <TableHead className="text-right">Сдано</TableHead>
                    <TableHead className="text-right">Средний</TableHead>
                    <TableHead className="text-right">Лучший</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.admins.map((row) => (
                    <TableRow key={row.userId} data-state={row.userId === userId ? "selected" : undefined}>
                      <TableCell className="max-w-48 truncate pl-4 font-medium">
                        <Link
                          href={href({ user: row.userId, test: testId })}
                          prefetch={false}
                          className="hover:text-primary hover:underline"
                        >
                          <PersonName person={row.user} />
                        </Link>
                        <span className="block font-normal text-muted-foreground text-xs">
                          {formatDateTime(row.lastAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.attempts}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.passed}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.averagePercent}%</TableCell>
                      <TableCell className="text-right tabular-nums">{row.bestPercent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Тесты</CardTitle>
            <CardDescription>
              Как проходят каждый тест. Нажмите на название, чтобы отфильтровать попытки.
            </CardDescription>
          </CardHeader>
          {overview.tests.length === 0 ? (
            <p className="px-4 py-6 text-center text-muted-foreground text-sm">Данных пока нет.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[420px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Тест</TableHead>
                    <TableHead className="text-right">Попыток</TableHead>
                    <TableHead className="text-right">Сдано</TableHead>
                    <TableHead className="text-right">Средний</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.tests.map((row) => (
                    <TableRow key={row.testId} data-state={row.testId === testId ? "selected" : undefined}>
                      <TableCell className="max-w-56 truncate pl-4 font-medium">
                        <Link
                          href={href({ user: userId, test: row.testId })}
                          prefetch={false}
                          className="hover:text-primary hover:underline"
                        >
                          {row.testTitle}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.attempts}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.passed}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.averagePercent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Попытки</CardTitle>
          <CardDescription>
            Показано: {attempts.length}. Откройте попытку, чтобы увидеть, где ошибся администратор, и разбор.
          </CardDescription>
          {(activeUser || activeTest || userId || testId) && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {(activeUser || userId) && (
                <Badge variant="secondary">
                  {activeUser ? personLabel(activeUser.user) : "Администратор"}
                  <Link
                    href={href({ test: testId })}
                    prefetch={false}
                    aria-label="Убрать фильтр по администратору"
                    className="ml-1 rounded-sm hover:bg-foreground/10"
                  >
                    <X className="size-3" />
                  </Link>
                </Badge>
              )}
              {(activeTest || testId) && (
                <Badge variant="secondary">
                  {activeTest?.testTitle ?? "Тест"}
                  <Link
                    href={href({ user: userId })}
                    prefetch={false}
                    aria-label="Убрать фильтр по тесту"
                    className="ml-1 rounded-sm hover:bg-foreground/10"
                  >
                    <X className="size-3" />
                  </Link>
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
        <AttemptsTable
          attempts={attempts}
          showUser
          detailsHref={(attempt) => `/dashboard/academy/results/${attempt.id}`}
          emptyText="Попыток по выбранным условиям нет."
        />
      </Card>
    </div>
  );
}
