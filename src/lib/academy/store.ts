import { getPeopleSafe } from "@/lib/auth/db";
import { type Person, personFromName } from "@/lib/auth/person";
import { getPool } from "@/lib/db/pool";

import { generateRulesQuestions, RulesGenerationError } from "./generator";
import { seedTests } from "./seed";
import {
  type AcademyTest,
  type AttemptDetails,
  type AttemptQuestion,
  type AttemptSummary,
  type Difficulty,
  INVITE_LIMITS,
  type InviteLanding,
  type InviteStatus,
  type InviteSummary,
  type PublicQuestion,
  percentOf,
  type QuestionDef,
  type RulesConfig,
} from "./types";
import type { TestInput } from "./validate";
import { createHash, randomBytes, randomUUID } from "node:crypto";

/**
 * Академия хранится в Postgres:
 *  - academy_tests    — тесты (вручную составленные или с автогенерацией вопросов по правилам);
 *  - academy_attempts — попытки прохождения. В попытке сохраняется снимок вопросов с правильными ответами,
 *                       поэтому результаты не меняются, если тест потом отредактировали или удалили.
 * При первом запуске таблицы создаются и заполняются встроенными тестами (из seed.ts).
 */

export class AcademyStoreError extends Error {
  constructor(
    readonly code: "not_found" | "database" | "already_finished" | "generation" | "invalid",
    message?: string,
    cause?: unknown,
  ) {
    super(message ?? code, { cause });
  }
}

const LOCK_ID = 727_005;
/** Незавершённые попытки старше этого срока удаляются */
const STALE_ATTEMPT_DAYS = 2;

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Блокировка нужна, чтобы два запущенных сервиса не создавали и не заполняли таблицы одновременно.
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    const existed = (await client.query("SELECT to_regclass('academy_tests') AS t")).rows[0]?.t !== null;

    await client.query(`CREATE TABLE IF NOT EXISTS academy_tests (
      id           text PRIMARY KEY,
      position     bigserial NOT NULL,
      title        text NOT NULL,
      description  text NOT NULL DEFAULT '',
      category     text NOT NULL,
      difficulty   text NOT NULL,
      duration_min integer NOT NULL,
      pass_percent integer NOT NULL DEFAULT 70,
      kind         text NOT NULL DEFAULT 'manual',
      questions    jsonb NOT NULL DEFAULT '[]'::jsonb,
      rules        jsonb,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now(),
      updated_by   text
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS academy_attempts (
      id           text PRIMARY KEY,
      test_id      text NOT NULL,
      test_title   text NOT NULL,
      user_id      text NOT NULL,
      user_name    text NOT NULL,
      pass_percent integer NOT NULL,
      questions    jsonb NOT NULL,
      status       text NOT NULL DEFAULT 'in_progress',
      started_at   timestamptz NOT NULL DEFAULT now(),
      finished_at  timestamptz,
      score        integer,
      total        integer NOT NULL,
      percent      integer,
      passed       boolean
    )`);
    await client.query("ALTER TABLE academy_tests ADD COLUMN IF NOT EXISTS closed boolean NOT NULL DEFAULT false");
    // Одноразовые ссылки на закрытые тесты: в базе только хеш ссылки, сама ссылка показывается один раз
    await client.query(`CREATE TABLE IF NOT EXISTS academy_invites (
      id          text PRIMARY KEY,
      token_hash  text NOT NULL UNIQUE,
      test_id     text NOT NULL,
      label       text NOT NULL DEFAULT '',
      created_by  text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      expires_at  timestamptz NOT NULL,
      used_at     timestamptz,
      revoked_at  timestamptz,
      attempt_id  text
    )`);
    await client.query(
      "CREATE INDEX IF NOT EXISTS academy_invites_test_idx ON academy_invites (test_id, created_at DESC)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS academy_attempts_user_idx ON academy_attempts (user_id, finished_at DESC)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS academy_attempts_finished_idx ON academy_attempts (finished_at DESC) WHERE status = 'finished'",
    );

    // Встроенные тесты добавляются только при создании таблицы: удалённые потом не возвращаются
    if (!existed) {
      for (const test of seedTests) {
        await client.query(
          `INSERT INTO academy_tests (id, title, description, category, difficulty, duration_min, pass_percent, kind, questions, rules)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb) ON CONFLICT (id) DO NOTHING`,
          [
            test.id,
            test.title,
            test.description,
            test.category,
            test.difficulty,
            test.durationMin,
            test.passPercent,
            test.kind,
            JSON.stringify(test.questions),
            test.rules ? JSON.stringify(test.rules) : null,
          ],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[academy] ROLLBACK failed", rollbackError));
    throw error;
  } finally {
    client.release();
  }
}

function ensureReady(): Promise<void> {
  ready ??= init().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

async function run<T>(task: () => Promise<T>): Promise<T> {
  try {
    await ensureReady();
    return await task();
  } catch (error) {
    if (error instanceof AcademyStoreError) throw error;
    throw new AcademyStoreError("database", "database", error);
  }
}

/* Тесты */

type TestRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  duration_min: number;
  pass_percent: number;
  kind: string;
  questions: QuestionDef[];
  rules: RulesConfig | null;
  closed: boolean;
  updated_at: string | Date;
};

const toTest = (row: TestRow): AcademyTest => ({
  id: row.id,
  title: row.title,
  description: row.description,
  category: row.category,
  difficulty: row.difficulty as Difficulty,
  durationMin: row.duration_min,
  passPercent: row.pass_percent,
  kind: row.kind === "rules" ? "rules" : "manual",
  questions: Array.isArray(row.questions) ? row.questions : [],
  rules: row.rules ?? null,
  closed: row.closed === true,
  updatedAt: new Date(row.updated_at).toISOString(),
});

const TEST_COLUMNS =
  "id, title, description, category, difficulty, duration_min, pass_percent, kind, questions, rules, closed, updated_at";

export const listTests = () =>
  run(async () => {
    const { rows } = await getPool().query<TestRow>(`SELECT ${TEST_COLUMNS} FROM academy_tests ORDER BY position ASC`);
    return rows.map(toTest);
  });

export const getTest = (id: string) =>
  run(async () => {
    const { rows } = await getPool().query<TestRow>(`SELECT ${TEST_COLUMNS} FROM academy_tests WHERE id = $1`, [id]);
    return rows[0] ? toTest(rows[0]) : null;
  });

const withIds = (questions: Omit<QuestionDef, "id">[]): QuestionDef[] =>
  questions.map((question, index) => ({ ...question, id: `q${index + 1}` }));

export const createTest = (input: TestInput, updatedBy: string) =>
  run(async () => {
    const id = randomUUID();
    await getPool().query(
      `INSERT INTO academy_tests (id, title, description, category, difficulty, duration_min, pass_percent, kind, questions, rules, updated_by, closed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12)`,
      [
        id,
        input.title,
        input.description,
        input.category,
        input.difficulty,
        input.durationMin,
        input.passPercent,
        input.kind,
        JSON.stringify(withIds(input.questions)),
        input.rules ? JSON.stringify(input.rules) : null,
        updatedBy,
        input.closed,
      ],
    );
    return id;
  });

export const updateTest = (id: string, input: TestInput, updatedBy: string) =>
  run(async () => {
    const result = await getPool().query(
      `UPDATE academy_tests SET title = $2, description = $3, category = $4, difficulty = $5, duration_min = $6,
         pass_percent = $7, kind = $8, questions = $9::jsonb, rules = $10::jsonb, updated_at = now(), updated_by = $11,
         closed = $12
       WHERE id = $1`,
      [
        id,
        input.title,
        input.description,
        input.category,
        input.difficulty,
        input.durationMin,
        input.passPercent,
        input.kind,
        JSON.stringify(withIds(input.questions)),
        input.rules ? JSON.stringify(input.rules) : null,
        updatedBy,
        input.closed,
      ],
    );
    if (result.rowCount === 0) throw new AcademyStoreError("not_found");
  });

/** Удаляет тест. Уже пройденные попытки остаются в результатах: в них сохранены и название, и вопросы. */
export const deleteTest = (id: string) =>
  run(async () => {
    const result = await getPool().query("DELETE FROM academy_tests WHERE id = $1", [id]);
    if (result.rowCount === 0) throw new AcademyStoreError("not_found");
    await getPool().query("DELETE FROM academy_attempts WHERE test_id = $1 AND status = 'in_progress'", [id]);
    await getPool().query("DELETE FROM academy_invites WHERE test_id = $1 AND used_at IS NULL", [id]);
  });

/* Прохождение */

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Вопросы и варианты ответов перемешиваются при каждом прохождении, чтобы нельзя было заучить позиции. */
function shuffleManual(questions: readonly QuestionDef[]): AttemptQuestion[] {
  return shuffle(questions).map((question) => {
    const order = shuffle(question.answers.map((_, index) => index));
    return {
      ...question,
      answers: order.map((index) => question.answers[index]),
      correct: order.indexOf(question.correct),
      chosen: null,
    };
  });
}

const toPublic = (question: AttemptQuestion): PublicQuestion => ({
  id: question.id,
  text: question.text,
  answers: question.answers,
  ...(question.source ? { source: question.source } : {}),
});

/** Создаёт попытку и возвращает вопросы без правильных ответов. Ответы остаются только на сервере. */
export const startAttempt = (test: AcademyTest, user: { id: string; name: string }) =>
  run(async () => {
    let questions: AttemptQuestion[];
    if (test.kind === "rules") {
      if (!test.rules) throw new AcademyStoreError("invalid", "У теста не заданы настройки автогенерации");
      try {
        questions = (await generateRulesQuestions(test.rules)).map((question) => ({ ...question, chosen: null }));
      } catch (error) {
        if (error instanceof RulesGenerationError) throw new AcademyStoreError("generation", error.message, error);
        throw error;
      }
    } else {
      questions = shuffleManual(test.questions);
    }
    if (questions.length === 0) throw new AcademyStoreError("invalid", "В тесте нет вопросов");

    const id = randomUUID();
    await getPool().query(
      "DELETE FROM academy_attempts WHERE status = 'in_progress' AND started_at < now() - ($1 * interval '1 day')",
      [STALE_ATTEMPT_DAYS],
    );
    await getPool().query(
      `INSERT INTO academy_attempts (id, test_id, test_title, user_id, user_name, pass_percent, questions, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [id, test.id, test.title, user.id, user.name, test.passPercent, JSON.stringify(questions), questions.length],
    );
    return { attemptId: id, questions: questions.map(toPublic) };
  });

type AttemptRow = {
  id: string;
  test_id: string;
  test_title: string;
  user_id: string;
  user_name: string;
  pass_percent: number;
  questions: AttemptQuestion[];
  status: string;
  started_at: string | Date;
  finished_at: string | Date | null;
  score: number | null;
  total: number;
  percent: number | null;
  passed: boolean | null;
};

const iso = (value: string | Date) => new Date(value).toISOString();

const toSummary = (row: AttemptRow): AttemptSummary => ({
  id: row.id,
  testId: row.test_id,
  testTitle: row.test_title,
  userId: row.user_id,
  userName: row.user_name,
  user: personFromName(row.user_name, row.user_id),
  finishedAt: iso(row.finished_at ?? row.started_at),
  score: row.score ?? 0,
  total: row.total,
  percent: row.percent ?? 0,
  passed: row.passed === true,
});

const toDetails = (row: AttemptRow): AttemptDetails => ({
  ...toSummary(row),
  passPercent: row.pass_percent,
  startedAt: iso(row.started_at),
  questions: row.questions,
});

export type SubmittedAttempt = AttemptDetails;

/**
 * Завершает попытку: ответы сверяются на сервере. Завершить можно только свою незавершённую попытку и только один раз.
 * chosen[i] — индекс выбранного варианта для i-го вопроса или null, если вопрос пропущен.
 */
export const submitAttempt = (attemptId: string, userId: string, chosen: readonly (number | null)[]) =>
  run(async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<AttemptRow>(
        "SELECT * FROM academy_attempts WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [attemptId, userId],
      );
      const row = rows[0];
      if (!row) throw new AcademyStoreError("not_found");
      if (row.status !== "in_progress") throw new AcademyStoreError("already_finished");
      if (chosen.length !== row.questions.length)
        throw new AcademyStoreError("invalid", "Ответы не соответствуют вопросам");

      const questions = row.questions.map((question, index) => {
        const answer = chosen[index];
        const valid =
          typeof answer === "number" && Number.isInteger(answer) && answer >= 0 && answer < question.answers.length;
        return { ...question, chosen: valid ? answer : null };
      });
      const score = questions.filter((question) => question.chosen === question.correct).length;
      const percent = percentOf(score, questions.length);
      const passed = percent >= row.pass_percent;

      const updated = await client.query<AttemptRow>(
        `UPDATE academy_attempts SET status = 'finished', finished_at = now(), questions = $2::jsonb,
           score = $3, percent = $4, passed = $5
         WHERE id = $1 RETURNING *`,
        [attemptId, JSON.stringify(questions), score, percent, passed],
      );
      await client.query("COMMIT");
      return toDetails(updated.rows[0]);
    } catch (error) {
      await client
        .query("ROLLBACK")
        .catch((rollbackError) => console.error("[academy] ROLLBACK failed", rollbackError));
      throw error;
    } finally {
      client.release();
    }
  });

/* Результаты */

export type AttemptFilter = { userId?: string; testId?: string; limit?: number };

const SUMMARY_COLUMNS =
  "id, test_id, test_title, user_id, user_name, pass_percent, status, started_at, finished_at, score, total, percent, passed";

/** Подставляет актуальные Никнейм, Static ID и роль администраторов одним запросом. */
async function withUsers<T extends { user: Person }>(items: T[]): Promise<T[]> {
  const people = await getPeopleSafe(items.map((item) => item.user.id));
  return items.map((item) => ({ ...item, user: people.get(item.user.id) ?? item.user }));
}

export const listAttempts = (filter: AttemptFilter = {}) =>
  run(async () => {
    const where = ["status = 'finished'"];
    const params: unknown[] = [];
    if (filter.userId) {
      params.push(filter.userId);
      where.push(`user_id = $${params.length}`);
    }
    if (filter.testId) {
      params.push(filter.testId);
      where.push(`test_id = $${params.length}`);
    }
    params.push(Math.min(Math.max(filter.limit ?? 100, 1), 500));
    const { rows } = await getPool().query<AttemptRow>(
      `SELECT ${SUMMARY_COLUMNS} FROM academy_attempts WHERE ${where.join(" AND ")}
       ORDER BY finished_at DESC LIMIT $${params.length}`,
      params,
    );
    return withUsers(rows.map(toSummary));
  });

/** Попытка целиком, с вопросами и правильными ответами. Показывать только тем, у кого есть право на разбор. */
export const getAttempt = (id: string) =>
  run(async () => {
    const { rows } = await getPool().query<AttemptRow>(
      "SELECT * FROM academy_attempts WHERE id = $1 AND status = 'finished'",
      [id],
    );
    return rows[0] ? (await withUsers([toDetails(rows[0])]))[0] : null;
  });

export type UserStats = {
  attempts: number;
  passed: number;
  averagePercent: number;
  bestPercent: number;
  lastAt: string | null;
  recent: AttemptSummary[];
};

export const getUserStats = (userId: string, recentLimit = 5) =>
  run(async (): Promise<UserStats> => {
    const { rows } = await getPool().query<{
      attempts: number;
      passed: number;
      average: string | null;
      best: number | null;
      last_at: string | Date | null;
    }>(
      `SELECT count(*)::int AS attempts, count(*) FILTER (WHERE passed)::int AS passed,
              avg(percent) AS average, max(percent) AS best, max(finished_at) AS last_at
       FROM academy_attempts WHERE user_id = $1 AND status = 'finished'`,
      [userId],
    );
    const row = rows[0];
    const recent = recentLimit > 0 ? await listAttempts({ userId, limit: recentLimit }) : [];
    return {
      attempts: row?.attempts ?? 0,
      passed: row?.passed ?? 0,
      averagePercent: row?.average ? Math.round(Number(row.average)) : 0,
      bestPercent: row?.best ?? 0,
      lastAt: row?.last_at ? iso(row.last_at) : null,
      recent,
    };
  });

export type AdminResultRow = {
  userId: string;
  userName: string;
  user: Person;
  attempts: number;
  passed: number;
  averagePercent: number;
  bestPercent: number;
  lastAt: string;
};

export type TestResultRow = {
  testId: string;
  testTitle: string;
  attempts: number;
  passed: number;
  averagePercent: number;
};

/** Сводка по всем администраторам и тестам для раздела «Результаты тестов». */
export const getOverview = () =>
  run(async () => {
    const pool = getPool();
    const admins = await pool.query<{
      user_id: string;
      user_name: string;
      attempts: number;
      passed: number;
      average: string;
      best: number;
      last_at: string | Date;
    }>(
      `SELECT user_id, (array_agg(user_name ORDER BY finished_at DESC))[1] AS user_name, count(*)::int AS attempts,
              count(*) FILTER (WHERE passed)::int AS passed, avg(percent) AS average, max(percent) AS best,
              max(finished_at) AS last_at
       FROM academy_attempts WHERE status = 'finished' GROUP BY user_id ORDER BY max(finished_at) DESC`,
    );
    const tests = await pool.query<{
      test_id: string;
      test_title: string;
      attempts: number;
      passed: number;
      average: string;
    }>(
      `SELECT test_id, (array_agg(test_title ORDER BY finished_at DESC))[1] AS test_title, count(*)::int AS attempts,
              count(*) FILTER (WHERE passed)::int AS passed, avg(percent) AS average
       FROM academy_attempts WHERE status = 'finished' GROUP BY test_id ORDER BY count(*) DESC`,
    );
    const adminRows = await withUsers(
      admins.rows.map(
        (row): AdminResultRow => ({
          userId: row.user_id,
          userName: row.user_name,
          user: personFromName(row.user_name, row.user_id),
          attempts: row.attempts,
          passed: row.passed,
          averagePercent: Math.round(Number(row.average)),
          bestPercent: row.best,
          lastAt: iso(row.last_at),
        }),
      ),
    );
    return {
      admins: adminRows,
      tests: tests.rows.map(
        (row): TestResultRow => ({
          testId: row.test_id,
          testTitle: row.test_title,
          attempts: row.attempts,
          passed: row.passed,
          averagePercent: Math.round(Number(row.average)),
        }),
      ),
    };
  });

/* Одноразовые ссылки на закрытые тесты */

const GUEST_PREFIX = "guest:";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const validToken = (token: unknown): token is string =>
  typeof token === "string" && /^[A-Za-z0-9_-]{20,80}$/.test(token);

type InviteRow = {
  id: string;
  token_hash: string;
  test_id: string;
  label: string;
  created_at: string | Date;
  expires_at: string | Date;
  used_at: string | Date | null;
  revoked_at: string | Date | null;
};

function inviteStatus(row: Pick<InviteRow, "used_at" | "revoked_at" | "expires_at">): InviteStatus {
  if (row.revoked_at) return "revoked";
  if (row.used_at) return "started";
  return new Date(row.expires_at).getTime() <= Date.now() ? "expired" : "pending";
}

/** Создаёт ссылку на закрытый тест. Возвращает сам токен: больше его получить нельзя. */
export const createInvite = (testId: string, label: string, createdBy: string) =>
  run(async () => {
    const test = await getTest(testId);
    if (!test) throw new AcademyStoreError("not_found");
    if (!test.closed) throw new AcademyStoreError("invalid", "Ссылки создаются только для закрытых тестов");
    const token = randomBytes(24).toString("base64url");
    await getPool().query(
      `INSERT INTO academy_invites (id, token_hash, test_id, label, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + ($6 * interval '1 day'))`,
      [
        randomUUID(),
        hashToken(token),
        testId,
        label.trim().slice(0, INVITE_LIMITS.label),
        createdBy,
        INVITE_LIMITS.ttlDays,
      ],
    );
    return token;
  });

export const listInvites = (testId: string) =>
  run(async (): Promise<InviteSummary[]> => {
    const { rows } = await getPool().query<InviteRow>(
      `SELECT id, token_hash, test_id, label, created_at, expires_at, used_at, revoked_at
       FROM academy_invites WHERE test_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [testId],
    );
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      status: inviteStatus(row),
      createdAt: iso(row.created_at),
      expiresAt: iso(row.expires_at),
      usedAt: row.used_at ? iso(row.used_at) : null,
    }));
  });

/** Отзывает ещё не использованную ссылку. */
export const revokeInvite = (id: string, testId: string) =>
  run(async () => {
    const result = await getPool().query(
      "UPDATE academy_invites SET revoked_at = now() WHERE id = $1 AND test_id = $2 AND used_at IS NULL AND revoked_at IS NULL",
      [id, testId],
    );
    if (result.rowCount === 0) throw new AcademyStoreError("not_found");
  });

/** Что показать человеку, открывшему ссылку. Ссылка при этом не тратится. */
export const getInviteLanding = (token: string) =>
  run(async (): Promise<InviteLanding> => {
    if (!validToken(token)) return { ok: false, reason: "invalid" };
    const { rows } = await getPool().query<InviteRow>(
      "SELECT id, token_hash, test_id, label, created_at, expires_at, used_at, revoked_at FROM academy_invites WHERE token_hash = $1",
      [hashToken(token)],
    );
    const row = rows[0];
    if (!row) return { ok: false, reason: "invalid" };
    const status = inviteStatus(row);
    if (status === "revoked") return { ok: false, reason: "revoked" };
    if (status === "started") return { ok: false, reason: "used" };
    if (status === "expired") return { ok: false, reason: "expired" };
    const test = await getTest(row.test_id);
    if (!test?.closed) return { ok: false, reason: "invalid" };
    return {
      ok: true,
      test: {
        title: test.title,
        description: test.description,
        category: test.category,
        difficulty: test.difficulty,
        durationMin: test.durationMin,
        passPercent: test.passPercent,
        kind: test.kind,
        questionCount: test.kind === "rules" ? (test.rules?.questionCount ?? 0) : test.questions.length,
      },
    };
  });

/**
 * Начинает прохождение по ссылке и тратит её: второй раз та же ссылка уже не откроется.
 * Если вопросы собрать не удалось, ссылка возвращается, чтобы человек мог попробовать снова.
 */
export const startGuestAttempt = (token: string, guestName: string) =>
  run(async () => {
    if (!validToken(token)) throw new AcademyStoreError("not_found");
    const pool = getPool();
    const claimed = await pool.query<{ id: string; test_id: string }>(
      `UPDATE academy_invites SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
       RETURNING id, test_id`,
      [hashToken(token)],
    );
    const invite = claimed.rows[0];
    if (!invite) throw new AcademyStoreError("not_found");

    try {
      const test = await getTest(invite.test_id);
      if (!test?.closed) throw new AcademyStoreError("not_found");
      const name = `${guestName.trim().slice(0, INVITE_LIMITS.guestName)} (по ссылке)`;
      const started = await startAttempt(test, { id: `${GUEST_PREFIX}${invite.id}`, name });
      await pool.query("UPDATE academy_invites SET attempt_id = $2 WHERE id = $1", [invite.id, started.attemptId]);
      return { ...started, test };
    } catch (error) {
      await pool
        .query("UPDATE academy_invites SET used_at = NULL WHERE id = $1 AND attempt_id IS NULL", [invite.id])
        .catch((releaseError) => console.error("[academy] Не удалось вернуть ссылку", releaseError));
      throw error;
    }
  });

/** Завершает попытку, начатую по ссылке. Номер попытки известен только тому, кто её начал. */
export const submitGuestAttempt = (attemptId: string, chosen: readonly (number | null)[]) =>
  run(async () => {
    const { rows } = await getPool().query<{ user_id: string }>("SELECT user_id FROM academy_attempts WHERE id = $1", [
      attemptId,
    ]);
    const userId = rows[0]?.user_id;
    if (!userId?.startsWith(GUEST_PREFIX)) throw new AcademyStoreError("not_found");
    return submitAttempt(attemptId, userId, chosen);
  });
