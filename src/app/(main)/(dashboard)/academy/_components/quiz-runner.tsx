"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "cn";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, RotateCcw, XCircle } from "lucide-react";
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
  restarting?: boolean;
  /** Без onRestart и onExit (прохождение по ссылке) кнопок «Пройти ещё раз» и «К списку» нет */
  onRestart?: () => void;
  onExit?: () => void;
  /** Как отправить ответы: по умолчанию для администратора в Академии, для ссылки передаётся своя проверка */
  submit?: (attemptId: string, answers: (number | null)[]) => Promise<SubmitAttemptResult>;
};

type Finished = Extract<SubmitAttemptResult, { ok: true }>;

/** Как часто обновляются часы. Остаток считается по меткам времени, поэтому вкладка в фоне время не «замораживает». */
const TICK_MS = 250;
/** За сколько до конца таймер краснеет */
const WARN_MS = 10_000;

/** «12:05»: остаток округляется вверх, чтобы 0:00 показывалось только тогда, когда время действительно вышло. */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function TimerBadge({ ms, label }: { ms: number; label: string }) {
  return (
    <Badge
      variant="outline"
      title={label}
      className={cn("gap-1 tabular-nums", ms <= WARN_MS && "border-destructive/40 text-destructive")}
    >
      <Clock3 className="size-3" aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      {formatClock(ms)}
    </Badge>
  );
}

/** Прохождение теста. Правильные ответы сюда не приходят: проверка идёт на сервере. */
export function QuizRunner({
  test,
  attemptId,
  questions,
  restarting = false,
  onRestart,
  onExit,
  submit = submitAttemptAction,
}: QuizRunnerProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<Finished | null>(null);
  const [pending, startTransition] = useTransition();

  // Время. Общее время теста идёт с начала прохождения. Время на вопрос идёт, пока вопрос открыт, и копится по вопросам:
  // у вопроса без своего времени отдельного таймера нет, он живёт по общему времени теста.
  const totalMs = test.durationMin * 60_000;
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const [enteredAt, setEnteredAt] = useState(startedAt);
  const [spent, setSpent] = useState<number[]>(() => questions.map(() => 0));
  /** Автоотправка по концу времени сработала: повторно её не запускаем, дальше только кнопка */
  const autoFinished = useRef(false);

  const question = questions[index];
  const selected = answers[index];
  const isLast = index === questions.length - 1;
  const limitMs = question.timeLimitSec ? question.timeLimitSec * 1000 : null;
  const questionLeft = limitMs === null ? null : limitMs - (spent[index] + (now - enteredAt));
  const totalLeft = totalMs - (now - startedAt);
  const timeUp = totalLeft <= 0;
  const questionExpired = questionLeft !== null && questionLeft <= 0;
  // К вопросу со своим временем не возвращаемся: иначе ограничение теряет смысл
  const previousTimed = index > 0 && Boolean(questions[index - 1].timeLimitSec);
  let nextLabel = "Следующий вопрос";
  if (timeUp) nextLabel = pending ? "Проверка..." : "Отправить ответы";
  else if (isLast) nextLabel = pending ? "Проверка..." : "Завершить тест";

  const choose = (answerIndex: number) =>
    setAnswers((current) => current.map((value, i) => (i === index ? answerIndex : value)));

  const goTo = (next: number) => {
    const moment = Date.now();
    setSpent((current) => current.map((value, i) => (i === index ? value + (moment - enteredAt) : value)));
    setEnteredAt(moment);
    setNow(moment);
    setIndex(next);
  };

  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [result]);

  const finish = () => {
    startTransition(async () => {
      try {
        const response = await submit(attemptId, answers);
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

  // Время вышло: время теста заканчивает прохождение, время вопроса переводит к следующему вопросу (на последнем
  // тоже заканчивает). Неотвеченные вопросы уходят пустыми, выбранные ответы сохраняются.
  // biome-ignore lint/correctness/useExhaustiveDependencies: реагируем только на момент, когда время вышло
  useEffect(() => {
    if (result || pending) return;
    if (timeUp || (questionExpired && isLast)) {
      if (autoFinished.current) return;
      autoFinished.current = true;
      finish();
      return;
    }
    if (questionExpired) goTo(index + 1);
  }, [timeUp, questionExpired, isLast, index, result, pending]);

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
            {onRestart && onExit ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={onRestart} disabled={restarting}>
                  <RotateCcw data-icon="inline-start" />
                  {restarting ? "Подготовка..." : "Пройти ещё раз"}
                </Button>
                <Button variant="outline" onClick={onExit}>
                  К списку тестов
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Результат сохранён. Эту страницу можно закрыть.</p>
            )}
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
          {onExit ? (
            <Button variant="ghost" size="sm" onClick={onExit} disabled={pending}>
              <ArrowLeft data-icon="inline-start" />
              Все тесты
            </Button>
          ) : (
            <span className="font-medium text-sm">{test.title}</span>
          )}
          <div className="flex items-center gap-2">
            {question.source && <Badge variant="outline">{question.source}</Badge>}
            {questionLeft !== null && <TimerBadge ms={Math.min(questionLeft, totalLeft)} label="Осталось на вопрос" />}
            <TimerBadge ms={totalLeft} label="Осталось на весь тест" />
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
              disabled={questionExpired || timeUp || pending}
              className={`rounded-lg border p-4 text-left text-sm transition-colors hover:bg-muted ${selected === answerIndex ? "border-primary bg-primary/10" : "border-border"} disabled:pointer-events-none disabled:opacity-60`}
              aria-pressed={selected === answerIndex}
            >
              {String.fromCharCode(65 + answerIndex)}. {answer}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 pt-3">
          <Button
            variant="outline"
            disabled={index === 0 || pending || previousTimed || timeUp}
            onClick={() => goTo(index - 1)}
          >
            <ArrowLeft data-icon="inline-start" />
            Назад
          </Button>
          <Button
            disabled={(selected === null && !timeUp && !questionExpired) || pending}
            onClick={() => (isLast || timeUp ? finish() : goTo(index + 1))}
          >
            {nextLabel}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
        {timeUp ? (
          <p role="alert" className="text-destructive text-sm">
            {pending ? "Время вышло, ответы отправляются." : "Время вышло. Отправьте ответы кнопкой выше."}
          </p>
        ) : (
          previousTimed && (
            <p className="text-muted-foreground text-xs">К предыдущему вопросу вернуться нельзя: у него было своё время.</p>
          )
        )}
      </CardContent>
    </Card>
  );
}
