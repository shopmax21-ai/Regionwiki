"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { getAdmin } from "@/lib/auth/admin";
import { personPlainText } from "@/lib/auth/person";
import { notifyReviewers } from "@/lib/punishments/notify";
import { searchRulePoints } from "@/lib/punishments/rules-index";
import {
  approveRequest,
  claimRequest,
  createRequest,
  issueRequest,
  markCopied,
  PunishmentStoreError,
  rejectRequest,
  releaseRequest,
  setForum,
} from "@/lib/punishments/store";
import type { RulePointHit } from "@/lib/punishments/types";
import { normalizeForum, noteSchema, validateRequest } from "@/lib/punishments/validate";

export type ActionResult = { ok: true } | { ok: false; error: string };

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

const MESSAGES = {
  not_found: "Заявка не найдена",
  taken: "Эту заявку уже взял другой администратор или её статус изменился. Обновите страницу.",
  forbidden: "Это действие доступно только администратору, который взял заявку",
  state: "В текущем статусе заявки это действие недоступно. Обновите страницу.",
  not_copied: "Сначала скопируйте команду",
  own: "Нельзя рассматривать собственную заявку",
  database: "База данных недоступна, попробуйте позже",
} as const;

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof PunishmentStoreError) {
    if (error.code === "database") console.error("[punishments] Операция не удалась", error.cause ?? error);
    return { ok: false, error: MESSAGES[error.code] };
  }
  console.error("[punishments] Операция не удалась", error);
  return { ok: false, error: MESSAGES.database };
}

function refresh() {
  revalidatePath("/dashboard/punishments", "layout");
}

const NO_ACCESS = { ok: false, error: "Недостаточно прав" } as const;
const UNKNOWN = { ok: false, error: "Неизвестная заявка" } as const;

/* ---------- Хелпер ---------- */

export async function createRequestAction(input: unknown): Promise<ActionResult> {
  const helper = await getAdmin("punishments.request");
  if (!helper) return NO_ACCESS;

  const result = validateRequest(input);
  if (!result.ok) return result;

  try {
    const created = await createRequest(result.value, { id: helper.id, name: helper.name });
    // Уведомление уходит после ответа: медленный Telegram не задерживает отправку заявки
    after(async () => {
      try {
        await notifyReviewers({
          number: created.number,
          requesterId: helper.id,
          requesterName: personPlainText(helper),
          staticId: result.value.staticId,
          kind: result.value.kind,
          muteChannel: result.value.muteChannel,
          duration: result.value.duration,
          forum: result.value.forum,
          rules: result.value.rules,
          evidenceCount: result.value.evidence.length,
        });
      } catch (error) {
        console.error("[punishments] Не удалось отправить уведомления о заявке", error);
      }
    });
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

/** Подсказки пунктов правил для поля «Пункты правил». */
export async function searchRulesAction(query: unknown): Promise<RulePointHit[]> {
  if (typeof query !== "string" || query.length > 80) return [];
  if (!(await getAdmin("punishments.request"))) return [];
  try {
    return await searchRulePoints(query);
  } catch (error) {
    console.error("[punishments] Поиск по правилам не удался", error);
    return [];
  }
}

/* ---------- Администратор ---------- */

async function reviewer() {
  const admin = await getAdmin("punishments.review");
  return admin ? { id: admin.id, name: admin.name } : null;
}

export async function claimRequestAction(id: string): Promise<ActionResult> {
  const admin = await reviewer();
  if (!admin) return NO_ACCESS;
  if (!validId(id)) return UNKNOWN;
  try {
    await claimRequest(id, admin);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

/** Вернуть заявку в очередь: взявший её администратор или Гл.Администратор (право «Все наказания»). */
export async function releaseRequestAction(id: string): Promise<ActionResult> {
  if (!validId(id)) return UNKNOWN;
  const chief = await getAdmin("punishments.all");
  const admin = chief ?? (await getAdmin("punishments.review"));
  if (!admin) return NO_ACCESS;
  try {
    await releaseRequest(id, { id: admin.id, name: admin.name }, chief !== null);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

export async function approveRequestAction(id: string): Promise<ActionResult> {
  const admin = await reviewer();
  if (!admin) return NO_ACCESS;
  if (!validId(id)) return UNKNOWN;
  try {
    await approveRequest(id, admin);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

export async function rejectRequestAction(id: string, note: unknown): Promise<ActionResult> {
  const admin = await reviewer();
  if (!admin) return NO_ACCESS;
  if (!validId(id)) return UNKNOWN;
  const parsed = noteSchema.safeParse(typeof note === "string" ? note : "");
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректная причина" };
  try {
    await rejectRequest(id, admin, parsed.data);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

/** Администратор указывает или меняет жалобу на форуме: она дописывается в конец команды. Пустая строка убирает её. */
export async function setForumAction(id: string, forum: unknown): Promise<ActionResult> {
  const admin = await reviewer();
  if (!admin) return NO_ACCESS;
  if (!validId(id)) return UNKNOWN;
  const parsed = normalizeForum(forum);
  if (!parsed.ok) return parsed;
  try {
    await setForum(id, admin, parsed.value);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

/** Администратор скопировал команду: запоминаем, чтобы открыть кнопку «Выдал наказание». */
export async function markCopiedAction(id: string): Promise<ActionResult> {
  const admin = await reviewer();
  if (!admin) return NO_ACCESS;
  if (!validId(id)) return UNKNOWN;
  try {
    await markCopied(id, admin);
  } catch (error) {
    return failure(error);
  }
  return { ok: true };
}

export async function issuePunishmentAction(id: string): Promise<ActionResult> {
  const admin = await reviewer();
  if (!admin) return NO_ACCESS;
  if (!validId(id)) return UNKNOWN;
  try {
    await issueRequest(id, admin);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}
