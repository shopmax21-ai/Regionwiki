"use server";

import { revalidatePath } from "next/cache";

import { type AdminContext, getAdminContext } from "@/lib/auth/admin";
import {
  CalendarStoreError,
  createEvent,
  deleteEvent,
  findConflicts,
  getEvent,
  setEventNotify,
  updateEvent,
} from "@/lib/calendar/store";
import type { ConflictInfo } from "@/lib/calendar/types";
import { validateEvent } from "@/lib/calendar/validate";

export type EventActionResult = { ok: true } | { ok: false; error: string; conflicts?: ConflictInfo[] };

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof CalendarStoreError && error.code === "not_found") {
    return { ok: false, error: "Мероприятие не найдено, возможно, его уже удалили" };
  }
  console.error("[calendar] Операция не удалась", error);
  return { ok: false, error: "База данных недоступна, попробуйте позже" };
}

/** Автор может менять своё мероприятие, а чужое только Гл.Администратор (право «Управление чужими мероприятиями»). */
const canChange = (admin: AdminContext, ownerId: string) =>
  admin.id === ownerId || admin.permissions.includes("calendar.manage");

const NO_ACCESS = { ok: false, error: "Календарь доступен только администраторам" } as const;
const FORBIDDEN = { ok: false, error: "Чужое мероприятие может менять только Гл.Администратор" } as const;
const UNKNOWN = { ok: false, error: "Неизвестное мероприятие" } as const;

function refresh() {
  revalidatePath("/dashboard/calendar");
}

/**
 * Зарегистрировать мероприятие. Если время пересекается с другими, возвращаем их список и ничего не сохраняем,
 * пока администратор не подтвердит (force). Так видно, с кем придётся пересечься.
 */
export async function createEventAction(input: unknown): Promise<EventActionResult> {
  const admin = await getAdminContext();
  if (!admin) return NO_ACCESS;

  const result = validateEvent(input);
  if (!result.ok) return result;

  try {
    if (!result.event.force) {
      const conflicts = await findConflicts(result.event.startsAt, result.event.endsAt);
      if (conflicts.length > 0) {
        return { ok: false, error: "Это время пересекается с другими мероприятиями", conflicts };
      }
    }
    await createEvent(result.event, { id: admin.id, name: admin.name });
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

export async function updateEventAction(id: string, input: unknown): Promise<EventActionResult> {
  const admin = await getAdminContext();
  if (!admin) return NO_ACCESS;
  if (!validId(id)) return UNKNOWN;

  const result = validateEvent(input);
  if (!result.ok) return result;

  try {
    const existing = await getEvent(id);
    if (!existing) return { ok: false, error: "Мероприятие не найдено, возможно, его уже удалили" };
    if (!canChange(admin, existing.ownerId)) return FORBIDDEN;

    if (!result.event.force) {
      const conflicts = await findConflicts(result.event.startsAt, result.event.endsAt, id);
      if (conflicts.length > 0) {
        return { ok: false, error: "Это время пересекается с другими мероприятиями", conflicts };
      }
    }
    await updateEvent(id, result.event);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

export async function deleteEventAction(id: string): Promise<EventActionResult> {
  const admin = await getAdminContext();
  if (!admin) return NO_ACCESS;
  if (!validId(id)) return UNKNOWN;

  try {
    const existing = await getEvent(id);
    if (!existing) return { ok: false, error: "Мероприятие не найдено, возможно, его уже удалили" };
    if (!canChange(admin, existing.ownerId)) return FORBIDDEN;
    await deleteEvent(id);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

/**
 * Включить или выключить напоминание в Telegram за час до начала. Напоминание получает тот, кто зарегистрировал
 * мероприятие, поэтому и переключать его может только он (Гл.Администратор тоже не может: сообщение ему не придёт).
 */
export async function setEventNotifyAction(id: string, notify: unknown): Promise<EventActionResult> {
  const admin = await getAdminContext();
  if (!admin) return NO_ACCESS;
  if (!validId(id)) return UNKNOWN;
  if (typeof notify !== "boolean") return { ok: false, error: "Неизвестное значение" };

  try {
    const existing = await getEvent(id);
    if (!existing) return { ok: false, error: "Мероприятие не найдено, возможно, его уже удалили" };
    if (existing.ownerId !== admin.id) {
      return { ok: false, error: "Напоминание приходит автору мероприятия, менять его может только он" };
    }
    await setEventNotify(id, notify);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}
