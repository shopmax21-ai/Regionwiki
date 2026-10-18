import { z } from "zod";

import { ruleGroups } from "@/app/(main)/(dashboard)/rules/_components/rules-meta";

import {
  DEFAULT_PASS_PERCENT,
  DIFFICULTIES,
  ACADEMY_LIMITS as L,
  type QuestionDef,
  RULE_GROUP_KEYS,
  type RulesConfig,
  type TEST_KINDS,
} from "./types";

/** Время на ответ: пустое значение (null или нет вовсе) значит «общее время теста». */
const timeSchema = z
  .number()
  .int("Время на ответ — целое число секунд")
  .min(L.minQuestionSec, `Время на ответ не меньше ${L.minQuestionSec} секунд`)
  .max(L.maxQuestionSec, "Слишком долгое время на один вопрос")
  .nullable();

const questionSchema = z
  .object({
    text: z.string().trim().min(1, "Введите текст вопроса").max(L.questionText, "Текст вопроса слишком длинный"),
    answers: z
      .array(z.string().trim().min(1, "Ответ не может быть пустым").max(L.answerText, "Ответ слишком длинный"))
      .min(L.minAnswers, `Нужно минимум ${L.minAnswers} варианта ответа`)
      .max(L.maxAnswers, `Не больше ${L.maxAnswers} вариантов ответа`),
    correct: z.number().int().min(0),
    explanation: z.string().trim().max(L.explanation, "Разбор слишком длинный").default(""),
    timeLimitSec: timeSchema.optional(),
  })
  .superRefine((question, ctx) => {
    if (question.correct >= question.answers.length) {
      ctx.addIssue({ code: "custom", message: "Отметьте правильный ответ", path: ["correct"] });
    }
    const unique = new Set(question.answers.map((answer) => answer.toLowerCase()));
    if (unique.size !== question.answers.length) {
      ctx.addIssue({ code: "custom", message: "Варианты ответа не должны повторяться", path: ["answers"] });
    }
  });

const baseShape = {
  title: z.string().trim().min(1, "Введите название теста").max(L.title, "Название слишком длинное"),
  description: z.string().trim().max(L.description, "Описание слишком длинное").default(""),
  category: z.string().trim().min(1, "Укажите категорию").max(L.category, "Категория слишком длинная"),
  difficulty: z.enum(DIFFICULTIES, "Выберите сложность"),
  durationMin: z
    .number()
    .int()
    .min(L.minDuration, "Время должно быть не меньше минуты")
    .max(L.maxDuration, "Слишком долгий тест"),
  passPercent: z
    .number()
    .int()
    .min(1, "Проходной балл от 1%")
    .max(100, "Проходной балл до 100%")
    .default(DEFAULT_PASS_PERCENT),
  closed: z.boolean().default(false),
};

const manualSchema = z.object({
  ...baseShape,
  kind: z.literal("manual"),
  questions: z
    .array(questionSchema)
    .min(1, "Добавьте хотя бы один вопрос")
    .max(L.questions, `Не больше ${L.questions} вопросов`),
});

const rulesSchema = z.object({
  ...baseShape,
  kind: z.literal("rules"),
  rules: z.object({
    questionCount: z
      .number()
      .int()
      .min(L.minRulesQuestions, `Не меньше ${L.minRulesQuestions} вопросов`)
      .max(L.maxRulesQuestions, `Не больше ${L.maxRulesQuestions} вопросов`),
    groups: z.array(z.enum(RULE_GROUP_KEYS)),
    articles: z.array(z.string().max(80)).max(30).default([]),
    questionTimeSec: timeSchema.optional(),
  }),
});

const testSchema = z.discriminatedUnion("kind", [manualSchema, rulesSchema]);

export type TestInput = {
  title: string;
  description: string;
  category: string;
  difficulty: (typeof DIFFICULTIES)[number];
  durationMin: number;
  passPercent: number;
  kind: (typeof TEST_KINDS)[number];
  questions: Omit<QuestionDef, "id">[];
  rules: RulesConfig | null;
  closed: boolean;
};

export function validateTest(input: unknown): { ok: true; test: TestInput } | { ok: false; error: string } {
  const result = testSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path ?? [];
    // Для вопросов подсказываем номер, чтобы было понятно, где ошибка
    const index = path[0] === "questions" && typeof path[1] === "number" ? path[1] + 1 : null;
    const prefix = index === null ? "" : `Вопрос ${index}: `;
    return { ok: false, error: `${prefix}${issue?.message ?? "Проверьте заполнение формы"}` };
  }
  const data = result.data;

  // Время на вопрос не может быть больше времени на весь тест: иначе оно никогда не успеет закончиться
  const totalSec = data.durationMin * 60;
  if (data.kind === "manual") {
    const tooLong = data.questions.findIndex((question) => (question.timeLimitSec ?? 0) > totalSec);
    if (tooLong !== -1) {
      return { ok: false, error: `Вопрос ${tooLong + 1}: время на ответ больше времени на весь тест` };
    }
  } else if ((data.rules.questionTimeSec ?? 0) > totalSec) {
    return { ok: false, error: "Время на вопрос больше времени на весь тест" };
  }

  const common = {
    title: data.title,
    description: data.description,
    category: data.category,
    difficulty: data.difficulty,
    durationMin: data.durationMin,
    passPercent: data.passPercent,
    closed: data.closed,
  };
  if (data.kind === "manual") {
    // Пустое время на ответ не сохраняем вовсе: такой вопрос живёт по общему времени теста
    const questions = data.questions.map(({ timeLimitSec, ...question }) => ({
      ...question,
      ...(timeLimitSec ? { timeLimitSec } : {}),
    }));
    return { ok: true, test: { ...common, kind: "manual", questions, rules: null } };
  }
  const groups = [...new Set(data.rules.groups)];
  // Отдельные разделы берём только из ОП и только существующие. Если ОП выбрано целиком, они уже входят в него.
  const known = new Set(ruleGroups.general.articles.map((article) => article.slug));
  const articles = groups.includes("general")
    ? []
    : [...new Set(data.rules.articles)].filter((slug) => known.has(slug));
  if (groups.length === 0 && articles.length === 0) {
    return { ok: false, error: "Выберите правила целиком или хотя бы один раздел ОП" };
  }

  return {
    ok: true,
    test: {
      ...common,
      kind: "rules",
      questions: [],
      rules: {
        questionCount: data.rules.questionCount,
        groups,
        articles,
        ...(data.rules.questionTimeSec ? { questionTimeSec: data.rules.questionTimeSec } : {}),
      },
    },
  };
}
