"use server";

import { AcademyStoreError, startGuestAttempt, submitGuestAttempt } from "@/lib/academy/store";
import { INVITE_LIMITS, type StartAttemptResult, type SubmitAttemptResult } from "@/lib/academy/types";

const UNAVAILABLE = "Эта ссылка уже недействительна: её использовали, отозвали или истёк срок";

/** Начать тест по одноразовой ссылке. Ссылка тратится сразу, правильные ответы остаются на сервере. */
export async function startGuestAttemptAction(token: string, name: unknown): Promise<StartAttemptResult> {
  const guestName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (guestName.length < INVITE_LIMITS.minGuestName) return { ok: false, error: "Укажите имя или никнейм" };
  if (guestName.length > INVITE_LIMITS.guestName) return { ok: false, error: "Имя слишком длинное" };

  try {
    const started = await startGuestAttempt(token, guestName);
    return { ok: true, attemptId: started.attemptId, questions: started.questions };
  } catch (error) {
    if (error instanceof AcademyStoreError) {
      if (error.code === "not_found") return { ok: false, error: UNAVAILABLE };
      if (error.code === "generation" || error.code === "invalid") return { ok: false, error: error.message };
    }
    console.error("[academy] Не удалось начать тест по ссылке", error);
    return { ok: false, error: "Не удалось начать тест, попробуйте ещё раз" };
  }
}

/** Завершить тест по ссылке. Человек видит только итог: разбор ответов остаётся у Главных администраторов. */
export async function submitGuestAttemptAction(attemptId: string, chosen: unknown): Promise<SubmitAttemptResult> {
  if (typeof attemptId !== "string" || attemptId.length === 0 || attemptId.length > 64) {
    return { ok: false, error: "Неизвестная попытка" };
  }
  if (
    !Array.isArray(chosen) ||
    chosen.length > 100 ||
    chosen.some((value) => value !== null && typeof value !== "number")
  ) {
    return { ok: false, error: "Некорректные ответы" };
  }

  try {
    const attempt = await submitGuestAttempt(attemptId, chosen as (number | null)[]);
    return {
      ok: true,
      score: attempt.score,
      total: attempt.total,
      percent: attempt.percent,
      passed: attempt.passed,
      review: null,
    };
  } catch (error) {
    if (error instanceof AcademyStoreError) {
      if (error.code === "already_finished") return { ok: false, error: "Этот тест уже завершён" };
      if (error.code === "not_found") return { ok: false, error: "Попытка не найдена" };
      if (error.code === "invalid") return { ok: false, error: error.message };
    }
    console.error("[academy] Не удалось завершить тест по ссылке", error);
    return { ok: false, error: "Не удалось сохранить результат, попробуйте ещё раз" };
  }
}
