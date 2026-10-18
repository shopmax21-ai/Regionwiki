"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { markBirthdayGreeted } from "@/lib/auth/db";
import { mskDateParts } from "@/lib/birthdays/types";

/** Фейерверк уже показан: до конца дня (по Москве) повторный вход его не запускает. */
export async function markGreeted(): Promise<void> {
  const session = await getCurrentUser();
  if (!session) return;
  try {
    await markBirthdayGreeted(session.id, mskDateParts().key);
  } catch (error) {
    console.error("[birthday] Не удалось отметить поздравление", error);
  }
}
