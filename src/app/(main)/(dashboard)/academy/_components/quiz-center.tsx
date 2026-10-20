"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  Check,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  GraduationCap,
  Lock,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pluralize } from "@/lib/academy/format";
import type { AcademyTest, PublicQuestion, TestCardData } from "@/lib/academy/types";

import { startAttemptAction } from "../_actions";
import { QuizRunner } from "./quiz-runner";
import { TestDeleteDialog } from "./test-delete-dialog";
import { TestEditor } from "./test-editor";
import { TestInviteDialog } from "./test-invite-dialog";

type QuizCenterProps = {
  cards: TestCardData[];
  /** Полные тесты с правильными ответами для окна редактирования. Приходят только тем, у кого есть право. */
  editable: AcademyTest[] | null;
  canSeeResults: boolean;
  /** Почему тесты не загрузились (null, если всё в порядке) */
  problem: string | null;
};

type Running = { test: TestCardData; attemptId: string; questions: PublicQuestion[] };

const cardColors = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

export function QuizCenter({ cards, editable, canSeeResults, problem }: QuizCenterProps) {
  const router = useRouter();
  const [running, setRunning] = useState<Running | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TestCardData | null>(null);
  const [, startTransition] = useTransition();

  const canEdit = editable !== null;

  const start = (test: TestCardData) => {
    setStartingId(test.id);
    startTransition(async () => {
      try {
        const result = await startAttemptAction(test.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setRunning({ test, attemptId: result.attemptId, questions: result.questions });
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      } finally {
        setStartingId(null);
      }
    });
  };

  const exit = () => {
    setRunning(null);
    router.refresh();
  };

  if (running) {
    return (
      <QuizRunner
        // Новая попытка — новое состояние (вопросы другие, ответы пустые)
        key={running.attemptId}
        test={running.test}
        attemptId={running.attemptId}
        questions={running.questions}
        restarting={startingId === running.test.id}
        onRestart={() => start(running.test)}
        onExit={exit}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-2xl">Выберите тест</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSeeResults && (
            <Link href="/academy/results" prefetch={false} className={buttonVariants({ variant: "outline" })}>
              <ClipboardCheck data-icon="inline-start" />
              Результаты тестов
            </Link>
          )}
          {canEdit && <TestEditor mode="create" />}
        </div>
      </div>

      {problem && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          Не удалось загрузить тесты: {problem}
        </p>
      )}

      {!problem && cards.length === 0 && (
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center">
          <div className="relative mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ClipboardList className="size-8" aria-hidden="true" />
            <span className="absolute right-0 bottom-0 flex size-6 translate-x-1/4 translate-y-1/4 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
              <Check className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          <h3 className="font-semibold text-lg">Тестов пока нет</h3>
          <p className="mt-1 text-muted-foreground text-sm">Создайте и управляйте тестами для персонала.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {cards.map((card, index) => {
          const full = editable?.find((test) => test.id === card.id);
          return (
            <Card key={card.id} size="sm" className="flex flex-col">
              <CardHeader className="gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${cardColors[index % cardColors.length]} text-background [&_svg]:size-4`}
                    >
                      {card.kind === "rules" ? <Wand2 /> : <GraduationCap />}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <CardTitle className="line-clamp-2 text-sm leading-tight" title={card.title}>
                        {card.title}
                      </CardTitle>
                      <span className="truncate text-muted-foreground text-xs">{card.category}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="-mt-1 -mr-1 flex shrink-0 items-center">
                      {card.closed && <TestInviteDialog testId={card.id} title={card.title} />}
                      {full && <TestEditor mode="edit" test={full} />}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Удалить тест «${card.title}»`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(card)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
                <CardDescription className="line-clamp-2 min-h-8 text-xs leading-4">
                  {card.description || "Описание пока не добавлено"}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="outline">{card.difficulty}</Badge>
                  {card.closed && (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="size-3" aria-hidden="true" />
                      Закрытый
                    </Badge>
                  )}
                  {card.kind === "rules" && <Badge variant="secondary">Автогенерация</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
                  <span className="flex items-center gap-1">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    {card.durationMin} мин
                  </span>
                  <span>
                    {card.questionCount} {pluralize(card.questionCount, ["вопрос", "вопроса", "вопросов"])}
                  </span>
                  <span>Проходной {card.passPercent}%</span>
                </div>
                <Button size="sm" onClick={() => start(card)} disabled={startingId !== null}>
                  {startingId === card.id ? "Подготовка..." : "Начать тест"}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <TestDeleteDialog test={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
