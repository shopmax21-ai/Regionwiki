"use server";

import { getAuthConfig } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getUser, groupOfUser, setUserOnboarding } from "@/lib/auth/db";
import { validateOnboarding } from "@/lib/auth/identity";
import { notifyAdminsAboutRequest } from "@/lib/auth/telegram";

export type OnboardingResult = { ok: true; status: "pending" | "approved" | "rejected" } | { ok: false; error: string };

/**
 * Анкета первой авторизации: Никнейм, Static ID и предположительный уровень администрации.
 * Сохраняется один раз, дальше эти данные меняет только вышестоящий администратор.
 * Заявка на доступ уходит администраторам уже с этими данными.
 */
export async function completeOnboarding(input: unknown): Promise<OnboardingResult> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Войдите заново" };

  const fields = (typeof input === "object" && input !== null ? input : {}) as {
    nickname?: unknown;
    staticId?: unknown;
    group?: unknown;
  };

  try {
    const user = await getUser(session.id);
    if (!user) return { ok: false, error: "Войдите заново" };
    if (user.nickname !== null && user.staticId !== null) return { ok: true, status: user.status };

    // Уровень спрашиваем только у тех, кто ещё не назначен в группу администрации
    const parsed = validateOnboarding(fields, { groupRequired: groupOfUser(user) === null });
    if (!parsed.ok) return parsed;

    const { nickname, staticId, group } = parsed.value;
    const saved = await setUserOnboarding(user.telegramId, nickname, staticId, group);
    if (!saved) return { ok: true, status: user.status };

    const config = getAuthConfig();
    if (config && saved.status === "pending") await notifyAdminsAboutRequest(config, saved);
    return { ok: true, status: saved.status };
  } catch (error) {
    console.error("[auth] Не удалось сохранить анкету первой авторизации", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }
}
