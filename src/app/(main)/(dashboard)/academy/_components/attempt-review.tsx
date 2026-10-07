import { CheckCircle2, CircleSlash, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AttemptQuestion } from "@/lib/academy/types";

const letter = (index: number) => String.fromCharCode(65 + index);

function Verdict({ question }: { question: AttemptQuestion }) {
  if (question.chosen === null) {
    return (
      <Badge variant="outline">
        <CircleSlash data-icon="inline-start" />
        Пропущен
      </Badge>
    );
  }
  if (question.chosen === question.correct) {
    return (
      <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
        <CheckCircle2 data-icon="inline-start" />
        Верно
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <XCircle data-icon="inline-start" />
      Неверно
    </Badge>
  );
}

/** Разбор теста: что спросили, что выбрали, как правильно и почему. Только для тех, у кого есть право на разбор. */
export function AttemptReview({ questions }: { questions: AttemptQuestion[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {questions.map((question, index) => (
        <li key={question.id} className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-muted-foreground text-xs">
              Вопрос {index + 1}
              {question.source && <Badge variant="secondary">{question.source}</Badge>}
            </span>
            <Verdict question={question} />
          </div>
          <p className="font-medium text-sm leading-6">{question.text}</p>

          <ul className="flex flex-col gap-2">
            {question.answers.map((answer, answerIndex) => {
              const isCorrect = answerIndex === question.correct;
              const isChosen = answerIndex === question.chosen;
              let style = "border-border";
              if (isCorrect) style = "border-green-500/50 bg-green-500/10";
              else if (isChosen) style = "border-red-500/50 bg-red-500/10";
              return (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: порядок вариантов в попытке фиксирован
                  key={answerIndex}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${style}`}
                >
                  <span className="shrink-0 font-medium text-muted-foreground">{letter(answerIndex)}.</span>
                  <span className="min-w-0 flex-1 whitespace-pre-line">{answer}</span>
                  {isCorrect && (
                    <span className="shrink-0 font-medium text-green-600 text-xs dark:text-green-400">
                      Правильный ответ
                    </span>
                  )}
                  {isChosen && !isCorrect && (
                    <span className="shrink-0 font-medium text-red-600 text-xs dark:text-red-400">Выбран</span>
                  )}
                  {isChosen && isCorrect && <span className="shrink-0 text-muted-foreground text-xs">Выбран</span>}
                </li>
              );
            })}
          </ul>

          {question.explanation && (
            <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
              <p className="mb-1 font-medium text-xs uppercase tracking-wide">Разбор</p>
              <p className="whitespace-pre-line text-muted-foreground leading-6">{question.explanation}</p>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
