"use client";

import { useState, useTransition } from "react";

import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { PublicQuestion, SubmitAttemptResult, TestCardData } from "@/lib/academy/types";

import { submitAttemptAction } from "../_actions";
import { AttemptReview } from "./attempt-review";

type QuizRunnerProps = {
  test: TestCardData;
  attemptId: string;
  questions: PublicQuestion[];
  restarting: boolean;
  onRestart: () => void;
  onExit: () => void;
};

type Finished = Extract<SubmitAttemptResult, { ok: true }>;

/** Прохождение теста. Правильные ответы сюда не приходят: проверка идёт на сервере. */
export function QuizRunner({ test, attemptId, questions, restarting, onRestart, onExit }: QuizRunnerProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<Finished | null>(null);
  const [pending, startTransition] = useTransition();

  const question = questions[index];
  const selected = answers[index];
  const isLast = index === questions.length - 1;
  let nextLabel = "Следующий вопрос";
  if (isLast) nextLabel = pending ? "Проверка..." : "Завершить тест";

  const choose = (answerIndex: number) =>
    setAnswers((current) => current.map((value, i) => (i === index ? answerIndex : value)));

  const finish = () => {
    startTransition(async () => {
      try {
        const response = await submitAttemptAction(attemptId, answers);
        if (!response.ok) {
          toast.error(response.error);
          return;
        }
        setResult(response);
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  if (result) {
    const Icon = result.passed ? CheckCircle2 : XCircle;
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
            <div
              className={`flex size-16 items-center justify-center rounded-md ${result.passed ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}
            >
              <Icon className="size-8" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold text-xl">{result.passed ? "Тест сдан" : "Тест не сдан"}</h2>
              <p className="text-muted-foreground text-sm">
                {test.title}: {result.score} из {result.total} правильных ответов ({result.percent}%). Проходной балл:{" "}
                {test.passPercent}%.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={onRestart} disabled={restarting}>
                <RotateCcw data-icon="inline-start" />
                {restarting ? "Подготовка..." : "Пройти ещё раз"}
              </Button>
              <Button variant="outline" onClick={onExit}>
                К списку тестов
              </Button>
            </div>
          </CardContent>
        </Card>

        {result.review && (
          <section className="flex flex-col gap-3" aria-labelledby="review-title">
            <div className="flex flex-col gap-1">
              <h3 id="review-title" className="font-semibold text-lg">
                Разбор ответов
              </h3>
              <p className="text-muted-foreground text-sm">
                Правильность ответов и разбор видят только Главные администраторы. Он сохранён и в разделе «Результаты
                тестов».
              </p>
            </div>
            <AttemptReview questions={result.review} />
          </section>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onExit} disabled={pending}>
            <ArrowLeft data-icon="inline-start" />
            Все тесты
          </Button>
          <div className="flex items-center gap-2">
            {question.source && <Badge variant="outline">{question.source}</Badge>}
            <Badge variant="secondary">
              {index + 1} / {questions.length}
            </Badge>
          </div>
        </div>
        <Progress value={((index + 1) / questions.length) * 100} />
        <CardTitle className="pt-3 leading-7">{question.text}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2">
          {question.answers.map((answer, answerIndex) => (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: порядок вариантов фиксирован на время попытки
              key={answerIndex}
              onClick={() => choose(answerIndex)}
              className={`rounded-lg border p-4 text-left text-sm transition-colors hover:bg-muted ${selected === answerIndex ? "border-primary bg-primary/10" : "border-border"}`}
              aria-pressed={selected === answerIndex}
            >
              {String.fromCharCode(65 + answerIndex)}. {answer}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 pt-3">
          <Button
            variant="outline"
            disabled={index === 0 || pending}
            onClick={() => setIndex((current) => current - 1)}
          >
            <ArrowLeft data-icon="inline-start" />
            Назад
          </Button>
          <Button
            disabled={selected === null || pending}
            onClick={() => (isLast ? finish() : setIndex((current) => current + 1))}
          >
            {nextLabel}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
