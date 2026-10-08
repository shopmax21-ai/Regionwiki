"use server";

import { revalidatePath } from "next/cache";

import { getAdminContext } from "@/lib/auth/admin";
import { runRulesSync } from "@/lib/rules/sync";

export type ForceSyncResult = { ok: true; message: string } | { ok: false; error: string };

/** Принудительная проверка правил. Только Гл.Администратор, группа проверяется по базе, а не по cookie. */
export async function forceRulesSync(): Promise<ForceSyncResult> {
  const admin = await getAdminContext();
  if (admin?.group !== "chief") return { ok: false, error: "Недостаточно прав" };

  try {
    const result = await runRulesSync();
    if ("skipped" in result) {
      return result.skipped === "locked"
        ? { ok: false, error: "Проверка уже идёт, подождите минуту" }
        : { ok: false, error: "База данных недоступна" };
    }
    revalidatePath("/rules", "layout");
    revalidatePath("/");
    if (result.errors.length > 0) {
      return { ok: false, error: `Проверка завершилась с ошибками (${result.errors.length}): ${result.errors[0]}` };
    }
    return {
      ok: true,
      message:
        result.changed > 0
          ? `Правила обновлены: изменено разделов — ${result.changed}`
          : "Проверено, изменений в правилах нет",
    };
  } catch (error) {
    console.error("[rules-sync] Сбой ручной проверки", error);
    return { ok: false, error: "Не удалось выполнить проверку" };
  }
}
