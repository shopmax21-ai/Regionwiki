import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { PersonName } from "@/components/person-name";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, formatSpent } from "@/lib/academy/format";
import { getAttempt } from "@/lib/academy/store";
import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";

import { AttemptReview } from "../../_components/attempt-review";
import { PassBadge } from "../../_components/attempts-table";

export const metadata: Metadata = {
  title: "Разбор теста | Академия",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Одна попытка целиком: по каждому вопросу видно ответ администратора, правильный ответ и разбор. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!getAuthConfig()) redirect("/");
  if (!(await getAdmin("academy.results"))) redirect("/unauthorized");

  const { id } = await params;
  if (id.length > 64) notFound();
  const attempt = await getAttempt(id);
  if (!attempt) notFound();

  const correct = attempt.questions.filter((question) => question.chosen === question.correct).length;
  const skipped = attempt.questions.filter((question) => question.chosen === null).length;
  const facts = [
    { label: "Администратор", value: <PersonName person={attempt.user} /> },
    { label: "Завершён", value: formatDateTime(attempt.finishedAt) },
    { label: "Заняло времени", value: formatSpent(attempt.startedAt, attempt.finishedAt) },
    { label: "Проходной балл", value: `${attempt.passPercent}%` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-xl">{attempt.testTitle}</h1>
          <p className="text-muted-foreground text-sm">Разбор попытки: ответы, правильные варианты и пояснения.</p>
        </div>
        <Link href="/academy/results" prefetch={false} className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft data-icon="inline-start" />К результатам
        </Link>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl tabular-nums tracking-tight">{attempt.percent}%</span>
            <PassBadge passed={attempt.passed} />
            <span className="text-muted-foreground text-sm">
              {correct} верно из {attempt.total}
              {skipped > 0 ? `, пропущено ${skipped}` : ""}
            </span>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">{fact.label}</dt>
                <dd className="truncate font-medium text-sm">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <AttemptReview questions={attempt.questions} />
    </div>
  );
}
