"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { actorOf, recordAudit } from "@/lib/audit/store";
import { type AdminContext, getAdminContext } from "@/lib/auth/admin";
import { setNotifyCalendar } from "@/lib/auth/db";
import { personPlainText } from "@/lib/auth/person";
import { formatRange } from "@/lib/calendar/format";
import { type CalendarChange, notifyCalendarSubscribers } from "@/lib/calendar/notify";
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
  revalidatePath("/calendar");
}

/** Сообщение подписчикам уходит после ответа: медленный Telegram не задерживает сохранение. */
function announce(admin: AdminContext, change: () => Promise<CalendarChange | null>) {
  const actor = { id: admin.id, label: personPlainText(admin) };
  after(async () => {
    try {
      const resolved = await change();
      if (resolved) await notifyCalendarSubscribers(resolved, actor);
    } catch (error) {
      console.error("[calendar] Не удалось оповестить подписчиков", error);
    }
  });
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
    const createdId = await createEvent(result.event, { id: admin.id, name: admin.name });
    announce(admin, async () => {
      const event = await getEvent(createdId);
      return event ? { kind: "created", event } : null;
    });
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
    announce(admin, async () => {
      const updated = await getEvent(id);
      return updated ? { kind: "updated", before: existing, after: updated } : null;
    });
    // Правку чужого мероприятия (это может только Гл.Администратор) фиксируем в журнале аудита
    if (existing.ownerId !== admin.id) {
      await recordAudit(actorOf(admin), {
        category: "calendar",
        action: "calendar.updated_foreign",
        severity: "important",
        summary: `Изменено чужое мероприятие «${existing.title}»`,
        target: { type: "calendar_event", id, label: existing.title },
        details: {
          Организатор: personPlainText(existing.owner),
          Было: `${existing.title}, ${formatRange(existing.startsAt, existing.endsAt)}`,
          Стало: `${result.event.title}, ${formatRange(result.event.startsAt.toISOString(), result.event.endsAt.toISOString())}`,
        },
      });
    }
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
    announce(admin, async () => ({ kind: "deleted", event: existing }));
    if (existing.ownerId !== admin.id) {
      await recordAudit(actorOf(admin), {
        category: "calendar",
        action: "calendar.deleted_foreign",
        severity: "important",
        summary: `Удалено чужое мероприятие «${existing.title}»`,
        target: { type: "calendar_event", id, label: existing.title },
        details: {
          Организатор: personPlainText(existing.owner),
          Время: formatRange(existing.startsAt, existing.endsAt),
        },
      });
    }
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

/**
 * «Следить за календарём»: включает или выключает сообщения в Telegram о новых, изменённых и удалённых мероприятиях
 * других администраторов и напоминания за час до их начала. Настройка личная, у каждого администратора своя.
 */
export async function setCalendarTrackingAction(enabled: unknown): Promise<EventActionResult> {
  const admin = await getAdminContext();
  if (!admin) return NO_ACCESS;
  if (typeof enabled !== "boolean") return { ok: false, error: "Неизвестное значение" };

  try {
    await setNotifyCalendar(admin.id, enabled);
  } catch (error) {
    console.error("[calendar] Не удалось сохранить настройку слежения", error);
    return { ok: false, error: "База данных недоступна, попробуйте позже" };
  }
  refresh();
  return { ok: true };
}
