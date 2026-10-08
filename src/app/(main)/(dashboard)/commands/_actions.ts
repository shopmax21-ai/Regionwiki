"use server";

import { revalidatePath } from "next/cache";

import { actorOf, recordContentChange } from "@/lib/audit/store";
import { getAdmin } from "@/lib/auth/admin";
import { CommandStoreError, createCommand, deleteCommand, listCommands, updateCommand } from "@/lib/commands/store";
import { validateCommand } from "@/lib/commands/validate";

export type ActionResult = { ok: true } | { ok: false; error: string };

const DENIED: ActionResult = { ok: false, error: "Недостаточно прав для редактирования команд" };
const UNKNOWN: ActionResult = { ok: false, error: "Неизвестная команда" };

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

function failure(error: unknown): ActionResult {
  if (error instanceof CommandStoreError && error.code === "not_found") {
    return { ok: false, error: "Команда не найдена, возможно, её уже удалили" };
  }
  console.error("[commands] Не удалось сохранить изменения", error);
  return { ok: false, error: "База данных недоступна, попробуйте позже" };
}

/** Добавить команду. Нужно право «Редактирование команд сервера», оно проверяется по базе. */
export async function createCommandAction(input: unknown): Promise<ActionResult> {
  const admin = await getAdmin("commands.edit");
  if (!admin) return DENIED;

  const result = validateCommand(input);
  if (!result.ok) return result;

  try {
    await createCommand(result.command, admin.id);
    await recordContentChange(actorOf(admin), "command", "created", { label: result.command.command });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/commands");
  return { ok: true };
}

export async function updateCommandAction(id: string, input: unknown): Promise<ActionResult> {
  const admin = await getAdmin("commands.edit");
  if (!admin) return DENIED;
  if (!validId(id)) return UNKNOWN;

  const result = validateCommand(input);
  if (!result.ok) return result;

  try {
    await updateCommand(id, result.command, admin.id);
    await recordContentChange(actorOf(admin), "command", "updated", { id, label: result.command.command });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/commands");
  return { ok: true };
}

export async function deleteCommandAction(id: string): Promise<ActionResult> {
  const admin = await getAdmin("commands.edit");
  if (!admin) return DENIED;
  if (!validId(id)) return UNKNOWN;

  try {
    const name = await listCommands()
      .then(({ commands }) => commands.find((item) => item.id === id)?.command)
      .catch(() => undefined);
    await deleteCommand(id);
    await recordContentChange(actorOf(admin), "command", "deleted", { id, label: name ?? id });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/commands");
  return { ok: true };
}
