"use client";

import { useState, useTransition } from "react";

import { ArrowRight, Clock3, LinkIcon, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { QuizRunner } from "@/app/(main)/(dashboard)/academy/_components/quiz-runner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pluralize } from "@/lib/academy/format";
import { INVITE_LIMITS, type InviteLanding, type PublicQuestion, type TestCardData } from "@/lib/academy/types";

import { startGuestAttemptAction, submitGuestAttemptAction } from "../_actions";

const REASONS = {
  invalid: "Ссылка не найдена. Проверьте, что вы скопировали её целиком.",
  used: "Эта ссылка уже использована: по каждой ссылке тест проходят один раз.",
  expired: "Срок действия ссылки истёк. Попросите администратора выдать новую.",
  revoked: "Эту ссылку отозвали. Попросите администратора выдать новую.",
} as const;

type Running = { attemptId: string; questions: PublicQuestion[] };

export function GuestQuiz({ token, landing }: { token: string; landing: InviteLanding | null }) {
  const [name, setName] = useState("");
  const [running, setRunning] = useState<Running | null>(null);
  const [pending, startTransition] = useTransition();

  if (!landing) {
    return (
      <Notice
        title="Тест временно недоступен"
        text="Не удалось связаться с базой данных. Обновите страницу через минуту: ссылка при этом не потратилась."
      />
    );
  }
  if (!landing.ok) return <Notice title="Ссылка недействительна" text={REASONS[landing.reason]} />;

  const { test } = landing;
  const card: TestCardData = { ...test, id: "invite", closed: true };

  if (running) {
    return (
      <QuizRunner
        test={card}
        attemptId={running.attemptId}
        questions={running.questions}
        submit={submitGuestAttemptAction}
      />
    );
  }

  const start = () => {
    startTransition(async () => {
      try {
        const result = await startGuestAttemptAction(token, name);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setRunning({ attemptId: result.attemptId, questions: result.questions });
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  const ready = name.trim().length >= INVITE_LIMITS.minGuestName;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Закрытый тест</Badge>
          <Badge variant="outline">{test.difficulty}</Badge>
        </div>
        <CardTitle className="text-2xl leading-tight">{test.title}</CardTitle>
        {test.description && <CardDescription>{test.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-4" aria-hidden="true" />
            {test.durationMin} мин
          </span>
          <span>
            {test.questionCount} {pluralize(test.questionCount, ["вопрос", "вопроса", "вопросов"])}
          </span>
          <span>Проходной балл {test.passPercent}%</span>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-800 text-sm dark:text-amber-200">
          <LinkIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Ссылка одноразовая: она сгорит, как только вы нажмёте «Начать». Не закрывайте страницу до конца теста, иначе
          вторую попытку придётся запрашивать у администратора.
        </p>

        <div className="flex flex-col gap-2 sm:max-w-sm">
          <Label htmlFor="guest-name">Ваше имя или никнейм</Label>
          <Input
            id="guest-name"
            value={name}
            maxLength={INVITE_LIMITS.guestName}
            disabled={pending}
            autoComplete="nickname"
            placeholder="Например, Garik_Brown"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && ready && !pending) start();
            }}
          />
          <p className="text-muted-foreground text-xs">Под этим именем администраторы увидят ваш результат.</p>
        </div>

        <Button onClick={start} disabled={!ready || pending} className="self-start">
          {pending ? "Подготовка..." : "Начать тест"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </CardContent>
    </Card>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-md bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" aria-hidden="true" />
        </div>
        <h1 className="font-semibold text-xl">{title}</h1>
        <p className="max-w-md text-muted-foreground text-sm">{text}</p>
      </CardContent>
    </Card>
  );
}
