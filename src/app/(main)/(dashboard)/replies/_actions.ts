"use server";

import { revalidatePath } from "next/cache";

import { actorOf, recordContentChange } from "@/lib/audit/store";
import { getAdmin } from "@/lib/auth/admin";
import { createReply, deleteReply, listReplies, ReplyStoreError, updateReply } from "@/lib/replies/store";
import { validateReply } from "@/lib/replies/validate";

export type ActionResult = { ok: true } | { ok: false; error: string };

const DENIED: ActionResult = { ok: false, error: "Недостаточно прав для редактирования быстрых ответов" };

function failure(error: unknown): ActionResult {
  if (error instanceof ReplyStoreError && error.code === "not_found") {
    return { ok: false, error: "Ответ не найден, возможно, его уже удалили" };
  }
  console.error("[replies] Не удалось сохранить изменения", error);
  return { ok: false, error: "База данных недоступна, попробуйте позже" };
}

/** Добавить ответ. Нужно право «Редактирование быстрых ответов», оно проверяется по базе. */
export async function createReplyAction(input: unknown): Promise<ActionResult> {
  const admin = await getAdmin("replies.edit");
  if (!admin) return DENIED;

  const result = validateReply(input);
  if (!result.ok) return result;

  try {
    await createReply(result.reply, admin.id);
    await recordContentChange(actorOf(admin), "reply", "created", { label: result.reply.title });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/replies");
  return { ok: true };
}

export async function updateReplyAction(id: string, input: unknown): Promise<ActionResult> {
  const admin = await getAdmin("replies.edit");
  if (!admin) return DENIED;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "Неизвестный ответ" };

  const result = validateReply(input);
  if (!result.ok) return result;

  try {
    await updateReply(id, result.reply, admin.id);
    await recordContentChange(actorOf(admin), "reply", "updated", { id, label: result.reply.title });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/replies");
  return { ok: true };
}

export async function deleteReplyAction(id: string): Promise<ActionResult> {
  const admin = await getAdmin("replies.edit");
  if (!admin) return DENIED;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "Неизвестный ответ" };

  try {
    const title = await listReplies()
      .then(({ replies }) => replies.find((reply) => reply.id === id)?.title)
      .catch(() => undefined);
    await deleteReply(id);
    await recordContentChange(actorOf(admin), "reply", "deleted", { id, label: title ?? id });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/replies");
  return { ok: true };
}
