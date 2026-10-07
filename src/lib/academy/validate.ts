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

const questionSchema = z
  .object({
    text: z.string().trim().min(1, "Введите текст вопроса").max(L.questionText, "Текст вопроса слишком длинный"),
    answers: z
      .array(z.string().trim().min(1, "Ответ не может быть пустым").max(L.answerText, "Ответ слишком длинный"))
      .min(L.minAnswers, `Нужно минимум ${L.minAnswers} варианта ответа`)
      .max(L.maxAnswers, `Не больше ${L.maxAnswers} вариантов ответа`),
    correct: z.number().int().min(0),
    explanation: z.string().trim().max(L.explanation, "Разбор слишком длинный").default(""),
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
  const common = {
    title: data.title,
    description: data.description,
    category: data.category,
    difficulty: data.difficulty,
    durationMin: data.durationMin,
    passPercent: data.passPercent,
  };
  if (data.kind === "manual") {
    return { ok: true, test: { ...common, kind: "manual", questions: data.questions, rules: null } };
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
      rules: { questionCount: data.rules.questionCount, groups, articles },
    },
  };
}
