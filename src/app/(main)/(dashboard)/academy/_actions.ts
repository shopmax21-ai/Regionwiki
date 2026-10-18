"use server";

import { revalidatePath } from "next/cache";

import {
  AcademyStoreError,
  createInvite,
  createTest,
  deleteTest,
  getTest,
  listInvites,
  revokeInvite,
  startAttempt,
  submitAttempt,
  updateTest,
} from "@/lib/academy/store";
import {
  INVITE_LIMITS,
  type InviteSummary,
  type StartAttemptResult,
  type SubmitAttemptResult,
} from "@/lib/academy/types";
import { validateTest } from "@/lib/academy/validate";
import { actorOf, recordContentChange } from "@/lib/audit/store";
import { getAdmin, getAdminContext } from "@/lib/auth/admin";
import { getSiteOrigin } from "@/lib/overlay/site-origin";

export type ActionResult = { ok: true } | { ok: false; error: string };

const EDIT_DENIED: ActionResult = { ok: false, error: "Недостаточно прав для редактирования тестов" };
const ID_INVALID = { ok: false, error: "Неизвестный тест" } as const;

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof AcademyStoreError) {
    if (error.code === "not_found") return { ok: false, error: "Тест не найден, возможно, его уже удалили" };
    if (error.code === "already_finished") return { ok: false, error: "Этот тест уже завершён" };
    if (error.code === "generation" || error.code === "invalid") return { ok: false, error: error.message };
  }
  console.error("[academy] Операция не удалась", error);
  return { ok: false, error: "База данных недоступна, попробуйте позже" };
}

function refresh() {
  revalidatePath("/academy");
  revalidatePath("/academy/results");
  revalidatePath("/profile");
}

/** Создать тест. Нужно право «Редактирование тестов», оно проверяется по базе. */
export async function createTestAction(input: unknown): Promise<ActionResult> {
  const admin = await getAdmin("academy.edit");
  if (!admin) return EDIT_DENIED;

  const result = validateTest(input);
  if (!result.ok) return result;

  try {
    await createTest(result.test, admin.id);
    await recordContentChange(actorOf(admin), "test", "created", { label: result.test.title });
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

export async function updateTestAction(id: string, input: unknown): Promise<ActionResult> {
  const admin = await getAdmin("academy.edit");
  if (!admin) return EDIT_DENIED;
  if (!validId(id)) return ID_INVALID;

  const result = validateTest(input);
  if (!result.ok) return result;

  try {
    await updateTest(id, result.test, admin.id);
    await recordContentChange(actorOf(admin), "test", "updated", { id, label: result.test.title });
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

export async function deleteTestAction(id: string): Promise<ActionResult> {
  const admin = await getAdmin("academy.edit");
  if (!admin) return EDIT_DENIED;
  if (!validId(id)) return ID_INVALID;

  try {
    const title = await getTest(id)
      .then((test) => test?.title)
      .catch(() => undefined);
    await deleteTest(id);
    await recordContentChange(actorOf(admin), "test", "deleted", { id, label: title ?? id });
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

/** Начать прохождение: тесты проходят все администраторы. Правильные ответы остаются на сервере. */
export async function startAttemptAction(testId: string): Promise<StartAttemptResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: "Тесты доступны только администраторам" };
  if (!validId(testId)) return ID_INVALID;

  try {
    const test = await getTest(testId);
    if (!test) return { ok: false, error: "Тест не найден, возможно, его удалили" };
    // Закрытые тесты проходят по одноразовой ссылке; из общего списка их запускают только те, кто их редактирует
    if (test.closed && !admin.permissions.includes("academy.edit")) {
      return { ok: false, error: "Это закрытый тест: пройти его можно только по персональной ссылке" };
    }
    const started = await startAttempt(test, { id: admin.id, name: admin.name });
    return { ok: true, ...started };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Завершить прохождение. Проходящему возвращается только результат. Правильность ответов и разбор приходят
 * лишь тем, у кого есть право «Результаты и разбор тестов» (Гл.Администратор).
 */
export async function submitAttemptAction(attemptId: string, chosen: unknown): Promise<SubmitAttemptResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: "Тесты доступны только администраторам" };
  if (!validId(attemptId)) return { ok: false, error: "Неизвестная попытка" };
  if (
    !Array.isArray(chosen) ||
    chosen.length > 100 ||
    chosen.some((value) => value !== null && typeof value !== "number")
  ) {
    return { ok: false, error: "Некорректные ответы" };
  }

  try {
    const attempt = await submitAttempt(attemptId, admin.id, chosen as (number | null)[]);
    refresh();
    return {
      ok: true,
      score: attempt.score,
      total: attempt.total,
      percent: attempt.percent,
      passed: attempt.passed,
      review: admin.permissions.includes("academy.results") ? attempt.questions : null,
    };
  } catch (error) {
    return failure(error);
  }
}

/* Одноразовые ссылки на закрытые тесты: создают и отзывают те, кто редактирует тесты */

const INVITE_DENIED = { ok: false, error: "Недостаточно прав для редактирования тестов" } as const;

export type InviteCreated = { ok: true; url: string; invites: InviteSummary[] } | { ok: false; error: string };
export type InviteList = { ok: true; invites: InviteSummary[] } | { ok: false; error: string };

export async function listInvitesAction(testId: string): Promise<InviteList> {
  const admin = await getAdmin("academy.edit");
  if (!admin) return INVITE_DENIED;
  if (!validId(testId)) return ID_INVALID;
  try {
    return { ok: true, invites: await listInvites(testId) };
  } catch (error) {
    return failure(error);
  }
}

/** Создаёт ссылку. Адрес показывается один раз: в базе остаётся только его хеш. */
export async function createInviteAction(testId: string, label: unknown): Promise<InviteCreated> {
  const admin = await getAdmin("academy.edit");
  if (!admin) return INVITE_DENIED;
  if (!validId(testId)) return ID_INVALID;
  if (typeof label !== "string" || label.length > INVITE_LIMITS.label) {
    return { ok: false, error: "Пометка слишком длинная" };
  }
  const origin = await getSiteOrigin();
  if (!origin) return { ok: false, error: "Не удалось определить адрес сайта. Задайте OVERLAY_SITE_URL на сервере" };

  try {
    const token = await createInvite(testId, label, admin.id);
    const test = await getTest(testId).catch(() => null);
    await recordContentChange(actorOf(admin), "test", "updated", {
      id: testId,
      label: `${test?.title ?? testId}: ссылка${label.trim() ? ` для «${label.trim()}»` : ""}`,
    });
    return { ok: true, url: `${origin}/test/${token}`, invites: await listInvites(testId) };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeInviteAction(testId: string, inviteId: string): Promise<InviteList> {
  const admin = await getAdmin("academy.edit");
  if (!admin) return INVITE_DENIED;
  if (!validId(testId) || !validId(inviteId)) return ID_INVALID;
  try {
    await revokeInvite(inviteId, testId);
    return { ok: true, invites: await listInvites(testId) };
  } catch (error) {
    if (error instanceof AcademyStoreError && error.code === "not_found") {
      return { ok: false, error: "Ссылка уже использована или отозвана" };
    }
    return failure(error);
  }
}
