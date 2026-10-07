"use client";

import { type ReactNode, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowRight, ClipboardCheck, Clock3, GraduationCap, Trash2, Wand2 } from "lucide-react";
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

export type QuizKpis = { attempts: number; averagePercent: number; bestPercent: number };

type QuizCenterProps = {
  cards: TestCardData[];
  /** Полные тесты с правильными ответами для окна редактирования. Приходят только тем, у кого есть право. */
  editable: AcademyTest[] | null;
  kpis: QuizKpis;
  canSeeResults: boolean;
  /** Почему тесты не загрузились (null, если всё в порядке) */
  problem: string | null;
  /** Личные результаты текущего администратора: показываются под списком тестов */
  children: ReactNode;
};

type Running = { test: TestCardData; attemptId: string; questions: PublicQuestion[] };

const cardColors = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

export function QuizCenter({ cards, editable, kpis, canSeeResults, problem, children }: QuizCenterProps) {
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
    // Результат только что попал в базу: обновляем показатели и личный блок
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

  const stats = [
    { title: "Пройдено тестов", value: String(kpis.attempts), note: "всего попыток" },
    {
      title: "Средний результат",
      value: kpis.attempts > 0 ? `${kpis.averagePercent}%` : "—",
      note: "по всем попыткам",
    },
    { title: "Лучший результат", value: kpis.attempts > 0 ? `${kpis.bestPercent}%` : "—", note: "за всё время" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader>
              <CardTitle className="text-sm">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl tabular-nums tracking-tight">{stat.value}</span>
              <p className="text-muted-foreground text-xs">{stat.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-xl">Выберите тест</h2>
          <p className="text-muted-foreground text-sm">Проверьте знания и отслеживайте свой прогресс.</p>
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
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-muted-foreground text-sm">
          Тестов пока нет.{canEdit ? " Создайте первый кнопкой выше." : ""}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card, index) => {
          const full = editable?.find((test) => test.id === card.id);
          return (
            <Card key={card.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex size-10 items-center justify-center rounded-lg ${cardColors[index % cardColors.length]} text-background`}
                  >
                    {card.kind === "rules" ? <Wand2 /> : <GraduationCap />}
                  </div>
                  <div className="flex items-center gap-1">
                    {card.kind === "rules" && <Badge variant="secondary">Автогенерация</Badge>}
                    <Badge variant="outline">{card.difficulty}</Badge>
                    {canEdit && full && <TestEditor mode="edit" test={full} />}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Удалить тест «${card.title}»`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(card)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
                <CardTitle className="pt-2">{card.title}</CardTitle>
                <CardDescription>{card.description || "Описание пока не добавлено"}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
                  <span className="flex items-center gap-1">
                    <Clock3 />
                    {card.durationMin} мин
                  </span>
                  <span>
                    {card.questionCount} {pluralize(card.questionCount, ["вопрос", "вопроса", "вопросов"])}
                  </span>
                  <span>Проходной балл {card.passPercent}%</span>
                  <span>{card.category}</span>
                </div>
                <Button onClick={() => start(card)} disabled={startingId !== null}>
                  {startingId === card.id ? "Подготовка..." : "Начать тест"}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {children}

      <TestDeleteDialog test={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
