import type { Person } from "@/lib/auth/person";

/** Общие типы Академии. Файл без серверного кода: его можно импортировать и в клиентских компонентах. */

export const DIFFICULTIES = ["Легкий", "Средний", "Сложный"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const RULE_GROUP_KEYS = ["general", "government"] as const;
export type RuleGroupKey = (typeof RULE_GROUP_KEYS)[number];

export const RULE_GROUP_LABELS: Record<RuleGroupKey, string> = {
  general: "Основные правила",
  government: "Правила государственных структур",
};

export const TEST_KINDS = ["manual", "rules"] as const;
export type TestKind = (typeof TEST_KINDS)[number];

export const ACADEMY_LIMITS = {
  title: 120,
  description: 300,
  category: 60,
  questions: 50,
  questionText: 500,
  answerText: 250,
  explanation: 800,
  minAnswers: 2,
  maxAnswers: 6,
  minDuration: 1,
  maxDuration: 180,
  minRulesQuestions: 3,
  maxRulesQuestions: 30,
} as const;

export const DEFAULT_PASS_PERCENT = 70;

/** Вопрос теста вместе с правильным ответом. Наружу (к тому, кто проходит тест) не отдаётся. */
export type QuestionDef = {
  id: string;
  text: string;
  answers: string[];
  /** Индекс правильного ответа в answers */
  correct: number;
  /** Разбор: почему именно этот ответ верный */
  explanation: string;
};

/** Настройки автогенерации: сколько вопросов и из каких правил. */
export type RulesConfig = {
  questionCount: number;
  groups: RuleGroupKey[];
};

export type AcademyTest = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  durationMin: number;
  passPercent: number;
  kind: TestKind;
  /** Для kind = "manual". У автогенерируемого теста пусто: вопросы создаются при каждом прохождении. */
  questions: QuestionDef[];
  /** Для kind = "rules" */
  rules: RulesConfig | null;
  updatedAt: string;
};

/** Карточка теста для списка: без вопросов и правильных ответов. */
export type TestCardData = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  durationMin: number;
  passPercent: number;
  kind: TestKind;
  questionCount: number;
};

/** Вопрос так, как он показывается проходящему: без правильного ответа и разбора. */
export type PublicQuestion = {
  id: string;
  text: string;
  answers: string[];
  /** Откуда вопрос (для тестов по правилам: «ОП 1.7») */
  source?: string;
};

/** Вопрос в сохранённой попытке: что спрашивали, что выбрали и как правильно. */
export type AttemptQuestion = QuestionDef & { source?: string; chosen: number | null };

export type AttemptSummary = {
  id: string;
  testId: string;
  testTitle: string;
  userId: string;
  userName: string;
  /** Администратор для отображения: актуальные Никнейм, Statik ID и роль (запасной вариант: сохранённое имя) */
  user: Person;
  finishedAt: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
};

export type AttemptDetails = AttemptSummary & {
  passPercent: number;
  startedAt: string;
  questions: AttemptQuestion[];
};

export type StartAttemptResult =
  | { ok: true; attemptId: string; questions: PublicQuestion[] }
  | { ok: false; error: string };

export type SubmitAttemptResult =
  | {
      ok: true;
      score: number;
      total: number;
      percent: number;
      passed: boolean;
      /** Разбор приходит только тем, у кого есть право видеть правильные ответы */
      review: AttemptQuestion[] | null;
    }
  | { ok: false; error: string };

export const percentOf = (score: number, total: number) => (total === 0 ? 0 : Math.round((score / total) * 100));
