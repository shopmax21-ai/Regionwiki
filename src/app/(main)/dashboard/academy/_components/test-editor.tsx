"use client";

import { useId, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  type AcademyTest,
  DEFAULT_PASS_PERCENT,
  DIFFICULTIES,
  type Difficulty,
  ACADEMY_LIMITS as L,
  RULE_GROUP_KEYS,
  RULE_GROUP_LABELS,
  type RuleGroupKey,
  type TestKind,
} from "@/lib/academy/types";

import { createTestAction, updateTestAction } from "../_actions";

type QuestionForm = { key: string; text: string; answers: string[]; correct: number; explanation: string };

type FormState = {
  title: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  duration: string;
  passPercent: string;
  kind: TestKind;
  questions: QuestionForm[];
  questionCount: string;
  groups: RuleGroupKey[];
};

let keySeq = 0;
const nextKey = () => `q-${++keySeq}`;

const emptyQuestion = (): QuestionForm => ({
  key: nextKey(),
  text: "",
  answers: ["", "", "", ""],
  correct: 0,
  explanation: "",
});

const emptyForm = (): FormState => ({
  title: "",
  description: "",
  category: "",
  difficulty: "Средний",
  duration: "10",
  passPercent: String(DEFAULT_PASS_PERCENT),
  kind: "manual",
  questions: [emptyQuestion()],
  questionCount: "10",
  groups: [...RULE_GROUP_KEYS],
});

const formFromTest = (test: AcademyTest): FormState => ({
  title: test.title,
  description: test.description,
  category: test.category,
  difficulty: test.difficulty,
  duration: String(test.durationMin),
  passPercent: String(test.passPercent),
  kind: test.kind,
  questions:
    test.questions.length > 0
      ? test.questions.map((question) => ({
          key: nextKey(),
          text: question.text,
          answers: [...question.answers],
          correct: question.correct,
          explanation: question.explanation,
        }))
      : [emptyQuestion()],
  questionCount: String(test.rules?.questionCount ?? 10),
  groups: test.rules?.groups ?? [...RULE_GROUP_KEYS],
});

/** Куда сдвигается индекс правильного ответа после удаления варианта removed. */
function correctAfterRemoval(correct: number, removed: number): number {
  if (correct === removed) return 0;
  return correct > removed ? correct - 1 : correct;
}

/** Переводит поле формы в число; пустое и нечисловое значение превращается в NaN. */
const toInt = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

type Built = { ok: true; payload: unknown } | { ok: false; error: string };

function buildPayload(form: FormState): Built {
  const durationMin = toInt(form.duration);
  const passPercent = toInt(form.passPercent);
  if (Number.isNaN(durationMin)) return { ok: false, error: "Укажите время на тест в минутах" };
  if (Number.isNaN(passPercent)) return { ok: false, error: "Укажите проходной балл в процентах" };

  const common = {
    title: form.title,
    description: form.description,
    category: form.category,
    difficulty: form.difficulty,
    durationMin,
    passPercent,
  };

  if (form.kind === "rules") {
    const questionCount = toInt(form.questionCount);
    if (Number.isNaN(questionCount)) return { ok: false, error: "Укажите количество вопросов" };
    return { ok: true, payload: { ...common, kind: "rules", rules: { questionCount, groups: form.groups } } };
  }

  const questions: { text: string; answers: string[]; correct: number; explanation: string }[] = [];
  for (const [index, question] of form.questions.entries()) {
    // Пустые варианты отбрасываем, а индекс правильного пересчитываем
    const answers: string[] = [];
    let correct = -1;
    for (const [answerIndex, answer] of question.answers.entries()) {
      if (answer.trim() === "") continue;
      if (answerIndex === question.correct) correct = answers.length;
      answers.push(answer);
    }
    if (correct === -1) {
      return { ok: false, error: `Вопрос ${index + 1}: отметьте правильный ответ и заполните его текст` };
    }
    questions.push({ text: question.text, answers, correct, explanation: question.explanation });
  }
  return { ok: true, payload: { ...common, kind: "manual", questions } };
}

type TestEditorProps = { mode: "create" } | { mode: "edit"; test: AcademyTest };

/** Кнопка и окно создания или изменения теста. Показывается только тем, у кого есть право редактирования. */
export function TestEditor(props: TestEditorProps) {
  const editing = props.mode === "edit";
  const router = useRouter();
  const fieldId = useId();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateQuestion = (key: string, patch: Partial<QuestionForm>) =>
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) => (question.key === key ? { ...question, ...patch } : question)),
    }));

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    if (next) {
      setForm(props.mode === "edit" ? formFromTest(props.test) : emptyForm());
      setError(null);
    }
    setOpen(next);
  };

  const toggleGroup = (group: RuleGroupKey, checked: boolean) =>
    set("groups", checked ? [...new Set([...form.groups, group])] : form.groups.filter((item) => item !== group));

  const submit = () => {
    const built = buildPayload(form);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result =
          props.mode === "edit"
            ? await updateTestAction(props.test.id, built.payload)
            : await createTestAction(built.payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(editing ? "Тест сохранён" : "Тест создан");
        setOpen(false);
        router.refresh();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  const id = (name: string) => `${fieldId}-${name}`;
  let submitLabel = "Создать тест";
  if (pending) submitLabel = "Сохранение...";
  else if (editing) submitLabel = "Сохранить";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Изменить тест «${props.test.title}»`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" />
            Создать тест
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Изменить тест" : "Новый тест"}</DialogTitle>
          <DialogDescription>
            Вопросы можно написать самому или поручить генерацию по правилам проекта.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor={id("title")}>Название</Label>
            <Input
              id={id("title")}
              value={form.title}
              maxLength={L.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Например, «Правила ограблений»"
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor={id("description")}>Описание</Label>
            <Textarea
              id={id("description")}
              value={form.description}
              maxLength={L.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder="Коротко о чём тест"
              className="min-h-16"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={id("category")}>Категория</Label>
            <Input
              id={id("category")}
              value={form.category}
              maxLength={L.category}
              onChange={(event) => set("category", event.target.value)}
              placeholder="Правила"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={id("difficulty")}>Сложность</Label>
            <NativeSelect
              id={id("difficulty")}
              className="w-full"
              value={form.difficulty}
              onChange={(event) => set("difficulty", event.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((difficulty) => (
                <NativeSelectOption key={difficulty} value={difficulty}>
                  {difficulty}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={id("duration")}>Время, минут</Label>
            <Input
              id={id("duration")}
              inputMode="numeric"
              value={form.duration}
              onChange={(event) => set("duration", event.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={id("pass")}>Проходной балл, %</Label>
            <Input
              id={id("pass")}
              inputMode="numeric"
              value={form.passPercent}
              onChange={(event) => set("passPercent", event.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium text-sm">Вопросы</legend>
          <RadioGroup
            value={form.kind}
            onValueChange={(value) => set("kind", value as TestKind)}
            className="grid gap-2 sm:grid-cols-2"
          >
            <Label
              htmlFor={id("kind-manual")}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/5"
            >
              <RadioGroupItem id={id("kind-manual")} value="manual" className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-sm">Свои вопросы</span>
                <span className="font-normal text-muted-foreground text-xs">
                  Вы пишете вопросы, варианты ответов и разбор.
                </span>
              </span>
            </Label>
            <Label
              htmlFor={id("kind-rules")}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/5"
            >
              <RadioGroupItem id={id("kind-rules")} value="rules" className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 font-medium text-sm">
                  <Wand2 className="size-3.5" aria-hidden="true" />
                  Автогенерация по правилам
                </span>
                <span className="font-normal text-muted-foreground text-xs">
                  Вопросы создаются из текста правил при каждом прохождении.
                </span>
              </span>
            </Label>
          </RadioGroup>
        </fieldset>

        {form.kind === "rules" ? (
          <div className="flex flex-col gap-4 rounded-xl border p-4">
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Label htmlFor={id("count")}>Вопросов в одном прохождении</Label>
              <Input
                id={id("count")}
                inputMode="numeric"
                value={form.questionCount}
                onChange={(event) => set("questionCount", event.target.value.replace(/\D/g, "").slice(0, 2))}
              />
              <p className="text-muted-foreground text-xs">
                От {L.minRulesQuestions} до {L.maxRulesQuestions}.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-medium text-sm">Из каких правил брать вопросы</span>
              {RULE_GROUP_KEYS.map((group) => (
                <Label key={group} htmlFor={id(`group-${group}`)} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    id={id(`group-${group}`)}
                    checked={form.groups.includes(group)}
                    onCheckedChange={(checked) => toggleGroup(group, checked === true)}
                  />
                  {RULE_GROUP_LABELS[group]}
                </Label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs leading-5">
              Вопросы про наказания, разделы и принадлежность пунктов к статьям собираются из актуального текста правил,
              а неверные варианты берутся из других реальных пунктов. После прохождения Главные администраторы видят
              правильные ответы и разбор с номером пункта.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {form.questions.map((question, questionIndex) => (
              <div key={question.key} className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`${question.key}-text`} className="font-semibold">
                    Вопрос {questionIndex + 1}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Удалить вопрос ${questionIndex + 1}`}
                    disabled={form.questions.length === 1}
                    onClick={() =>
                      set(
                        "questions",
                        form.questions.filter((item) => item.key !== question.key),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <Textarea
                  id={`${question.key}-text`}
                  value={question.text}
                  maxLength={L.questionText}
                  onChange={(event) => updateQuestion(question.key, { text: event.target.value })}
                  placeholder="Текст вопроса"
                  className="min-h-16"
                />

                <div className="flex flex-col gap-2">
                  <span className="text-muted-foreground text-xs">Варианты ответа. Отметьте правильный.</span>
                  <RadioGroup
                    value={String(question.correct)}
                    onValueChange={(value) => updateQuestion(question.key, { correct: Number(value) })}
                  >
                    {question.answers.map((answer, answerIndex) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: у варианта нет собственного идентификатора
                      <div key={answerIndex} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={String(answerIndex)}
                          aria-label={`Вариант ${answerIndex + 1} правильный`}
                        />
                        <Input
                          value={answer}
                          maxLength={L.answerText}
                          aria-label={`Вариант ${answerIndex + 1}`}
                          placeholder={`Вариант ${answerIndex + 1}`}
                          onChange={(event) =>
                            updateQuestion(question.key, {
                              answers: question.answers.map((item, i) =>
                                i === answerIndex ? event.target.value : item,
                              ),
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Удалить вариант ${answerIndex + 1}`}
                          disabled={question.answers.length <= L.minAnswers}
                          onClick={() =>
                            updateQuestion(question.key, {
                              answers: question.answers.filter((_, i) => i !== answerIndex),
                              // Индекс правильного ответа сдвигается вместе со списком
                              correct: correctAfterRemoval(question.correct, answerIndex),
                            })
                          }
                        >
                          <X />
                        </Button>
                      </div>
                    ))}
                  </RadioGroup>
                  {question.answers.length < L.maxAnswers && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => updateQuestion(question.key, { answers: [...question.answers, ""] })}
                    >
                      <Plus data-icon="inline-start" />
                      Добавить вариант
                    </Button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${question.key}-explanation`} className="text-muted-foreground text-xs">
                    Разбор: почему этот ответ верный (увидят Главные администраторы)
                  </Label>
                  <Textarea
                    id={`${question.key}-explanation`}
                    value={question.explanation}
                    maxLength={L.explanation}
                    onChange={(event) => updateQuestion(question.key, { explanation: event.target.value })}
                    className="min-h-16"
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={form.questions.length >= L.questions}
              onClick={() => set("questions", [...form.questions, emptyQuestion()])}
            >
              <Plus data-icon="inline-start" />
              Добавить вопрос
            </Button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Отмена
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
