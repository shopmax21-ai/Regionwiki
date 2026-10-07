import { getPeopleSafe, listCalendarSubscribers } from "@/lib/auth/db";
import { personFromName } from "@/lib/auth/person";
import { getPool } from "@/lib/db/pool";

import {
  type CalendarEvent,
  type ConflictInfo,
  DEFAULT_EVENT_COLOR,
  isEventColor,
  REMINDER_LEAD_MINUTES,
} from "./types";
import type { EventInput } from "./validate";
import { randomUUID } from "node:crypto";

/**
 * Мероприятия хранятся в Postgres (таблица calendar_events). Статус («ожидается / идёт / закончилось») в базе не
 * хранится, он считается по времени. Для напоминаний в Telegram есть reminder_sent_at: его выставляет планировщик
 * атомарно, поэтому даже при нескольких запущенных копиях сайта сообщение уйдёт один раз.
 */

export class CalendarStoreError extends Error {
  constructor(
    readonly code: "not_found" | "forbidden" | "database",
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}

const LOCK_ID = 727_006;
/** Сколько раз пробуем отправить напоминание, прежде чем сдаться (например, если бот заблокирован) */
const MAX_REMINDER_ATTEMPTS = 5;

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS calendar_events (
      id                text PRIMARY KEY,
      title             text NOT NULL,
      description       text NOT NULL DEFAULT '',
      location          text NOT NULL DEFAULT '',
      starts_at         timestamptz NOT NULL,
      ends_at           timestamptz NOT NULL,
      owner_id          text NOT NULL,
      owner_name        text NOT NULL,
      notify            boolean NOT NULL DEFAULT true,
      reminder_sent_at  timestamptz,
      reminder_attempts integer NOT NULL DEFAULT 0,
      created_at        timestamptz NOT NULL DEFAULT now(),
      updated_at        timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query("CREATE INDEX IF NOT EXISTS calendar_events_starts_idx ON calendar_events (starts_at)");
    // Цвет мероприятия в календаре. Старые мероприятия получают цвет по умолчанию.
    await client.query(
      `ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '${DEFAULT_EVENT_COLOR}'`,
    );
    // Напоминания тем, кто следит за календарём: отдельно по каждому получателю, чтобы никто не получил дубль
    await client.query(`CREATE TABLE IF NOT EXISTS calendar_tracking_sent (
      event_id    text NOT NULL,
      telegram_id text NOT NULL,
      sent_at     timestamptz,
      attempts    integer NOT NULL DEFAULT 0,
      PRIMARY KEY (event_id, telegram_id)
    )`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => console.error("[calendar] ROLLBACK failed", rollbackError));
    throw error;
  } finally {
    client.release();
  }
}

function ensureReady(): Promise<void> {
  ready ??= init().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

async function run<T>(task: () => Promise<T>): Promise<T> {
  try {
    await ensureReady();
    return await task();
  } catch (error) {
    if (error instanceof CalendarStoreError) throw error;
    throw new CalendarStoreError("database", error);
  }
}

type EventRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string | Date;
  ends_at: string | Date;
  owner_id: string;
  owner_name: string;
  color: string;
  notify: boolean;
  reminder_sent_at: string | Date | null;
};

const COLUMNS =
  "id, title, description, location, starts_at, ends_at, owner_id, owner_name, color, notify, reminder_sent_at";

const toEvent = (row: EventRow): CalendarEvent => ({
  id: row.id,
  title: row.title,
  description: row.description,
  location: row.location,
  startsAt: new Date(row.starts_at).toISOString(),
  endsAt: new Date(row.ends_at).toISOString(),
  ownerId: row.owner_id,
  ownerName: row.owner_name,
  owner: personFromName(row.owner_name, row.owner_id),
  color: isEventColor(row.color) ? row.color : DEFAULT_EVENT_COLOR,
  notify: row.notify,
  reminded: row.reminder_sent_at !== null,
});

/** Подставляет актуальные Никнейм, Static ID и роль организаторов одним запросом. */
async function withOwners<T extends { owner: CalendarEvent["owner"] }>(events: T[]): Promise<T[]> {
  const people = await getPeopleSafe(events.map((event) => event.owner.id));
  return events.map((event) => ({ ...event, owner: people.get(event.owner.id) ?? event.owner }));
}

/**
 * Мероприятия для календаря: идущие сейчас, будущие и закончившиеся не раньше чем daysBack дней назад.
 * Старая история не грузится, чтобы страница оставалась быстрой.
 */
export const listEvents = (daysBack = 60) =>
  run(async () => {
    const { rows } = await getPool().query<EventRow>(
      `SELECT ${COLUMNS} FROM calendar_events WHERE ends_at > now() - ($1 * interval '1 day') ORDER BY starts_at ASC`,
      [daysBack],
    );
    return withOwners(rows.map(toEvent));
  });

export const getEvent = (id: string) =>
  run(async () => {
    const { rows } = await getPool().query<EventRow>(`SELECT ${COLUMNS} FROM calendar_events WHERE id = $1`, [id]);
    return rows[0] ? (await withOwners([toEvent(rows[0])]))[0] : null;
  });

/** Мероприятия других (и своих) администраторов, пересекающиеся с промежутком. excludeId нужен при правке. */
export const findConflicts = (startsAt: Date, endsAt: Date, excludeId?: string) =>
  run(async (): Promise<ConflictInfo[]> => {
    const { rows } = await getPool().query<EventRow>(
      `SELECT ${COLUMNS} FROM calendar_events
       WHERE starts_at < $2 AND ends_at > $1 AND ($3::text IS NULL OR id <> $3)
       ORDER BY starts_at ASC LIMIT 10`,
      [startsAt, endsAt, excludeId ?? null],
    );
    const events = await withOwners(rows.map(toEvent));
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      ownerName: event.ownerName,
      owner: event.owner,
    }));
  });

export const createEvent = (input: EventInput, owner: { id: string; name: string }) =>
  run(async () => {
    const id = randomUUID();
    await getPool().query(
      `INSERT INTO calendar_events (id, title, description, location, starts_at, ends_at, owner_id, owner_name, color, notify)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.title,
        input.description,
        input.location,
        input.startsAt,
        input.endsAt,
        owner.id,
        owner.name,
        input.color,
        input.notify,
      ],
    );
    return id;
  });

/**
 * Меняет мероприятие. Автор остаётся прежним (правит ли его сам автор или Гл.Администратор).
 * Если сдвинулось время начала или включили напоминание заново, оно снова готово к отправке.
 */
export const updateEvent = (id: string, input: EventInput) =>
  run(async () => {
    const pool = getPool();
    const before = await pool.query<{ starts_at: string | Date }>(
      "SELECT starts_at FROM calendar_events WHERE id = $1",
      [id],
    );
    const result = await pool.query(
      `UPDATE calendar_events SET title = $2, description = $3, location = $4, starts_at = $5, ends_at = $6, notify = $7, color = $8,
         reminder_sent_at = CASE WHEN starts_at IS DISTINCT FROM $5 OR notify IS DISTINCT FROM $7 THEN NULL ELSE reminder_sent_at END,
         reminder_attempts = CASE WHEN starts_at IS DISTINCT FROM $5 OR notify IS DISTINCT FROM $7 THEN 0 ELSE reminder_attempts END,
         updated_at = now()
       WHERE id = $1`,
      [id, input.title, input.description, input.location, input.startsAt, input.endsAt, input.notify, input.color],
    );
    if (result.rowCount === 0) throw new CalendarStoreError("not_found");
    // Время начала сдвинулось: тем, кто следит за календарём, напоминание нужно отправить заново
    const oldStart = before.rows[0] ? new Date(before.rows[0].starts_at).getTime() : null;
    if (oldStart !== null && oldStart !== input.startsAt.getTime()) {
      await pool.query("DELETE FROM calendar_tracking_sent WHERE event_id = $1", [id]);
    }
  });

export const setEventNotify = (id: string, notify: boolean) =>
  run(async () => {
    const result = await getPool().query(
      `UPDATE calendar_events SET notify = $2, reminder_sent_at = NULL, reminder_attempts = 0, updated_at = now() WHERE id = $1`,
      [id, notify],
    );
    if (result.rowCount === 0) throw new CalendarStoreError("not_found");
  });

export const deleteEvent = (id: string) =>
  run(async () => {
    const result = await getPool().query("DELETE FROM calendar_events WHERE id = $1", [id]);
    if (result.rowCount === 0) throw new CalendarStoreError("not_found");
    await getPool().query("DELETE FROM calendar_tracking_sent WHERE event_id = $1", [id]);
  });

/* Напоминания */

export type DueReminder = {
  id: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
  ownerId: string;
};

/**
 * Забирает мероприятия, о которых пора напомнить: до начала не больше часа, но оно ещё не началось.
 * Пометка reminder_sent_at ставится сразу, в той же команде (FOR UPDATE SKIP LOCKED), поэтому две копии
 * сайта не заберут одно и то же. Если отправка не удалась, вызовите releaseReminder: вернём в очередь.
 */
export const claimDueReminders = () =>
  run(async (): Promise<DueReminder[]> => {
    const { rows } = await getPool().query<EventRow>(
      `UPDATE calendar_events SET reminder_sent_at = now()
       WHERE id IN (
         SELECT id FROM calendar_events
         WHERE notify AND reminder_sent_at IS NULL AND reminder_attempts < $2
           AND starts_at > now() AND starts_at <= now() + ($1 * interval '1 minute')
         ORDER BY starts_at ASC LIMIT 50
         FOR UPDATE SKIP LOCKED
       )
       RETURNING ${COLUMNS}`,
      [REMINDER_LEAD_MINUTES, MAX_REMINDER_ATTEMPTS],
    );
    return rows.map((row) => {
      const event = toEvent(row);
      return {
        id: event.id,
        title: event.title,
        location: event.location,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        ownerId: event.ownerId,
      };
    });
  });

/** Отправка не удалась: возвращаем напоминание в очередь и считаем попытку. */
export const releaseReminder = (id: string) =>
  run(async () => {
    await getPool().query(
      "UPDATE calendar_events SET reminder_sent_at = NULL, reminder_attempts = reminder_attempts + 1 WHERE id = $1",
      [id],
    );
  });

/* Напоминания тем, кто следит за календарём */

export type DueTrackingReminder = DueReminder & { recipientId: string };

/**
 * Забирает напоминания для подписчиков («Следить за календарём»): за час до начала чужого мероприятия.
 * Автору своё мероприятие напоминает его собственный ползунок, поэтому ему здесь дубль не приходит.
 * Пара «мероприятие + получатель» забирается атомарно, поэтому две копии сайта не отправят сообщение дважды.
 */
export const claimTrackingReminders = () =>
  run(async (): Promise<DueTrackingReminder[]> => {
    const subscribers = (await listCalendarSubscribers()).map((user) => user.telegramId);
    if (subscribers.length === 0) return [];

    const { rows } = await getPool().query<{
      recipient_id: string;
      id: string;
      title: string;
      location: string;
      starts_at: string | Date;
      ends_at: string | Date;
      owner_id: string;
    }>(
      `WITH claimed AS (
         INSERT INTO calendar_tracking_sent (event_id, telegram_id, sent_at)
         SELECT e.id, s.telegram_id, now()
         FROM calendar_events e CROSS JOIN unnest($3::text[]) AS s(telegram_id)
         WHERE e.starts_at > now() AND e.starts_at <= now() + ($1 * interval '1 minute') AND e.owner_id <> s.telegram_id
         ORDER BY e.starts_at ASC
         LIMIT 200
         ON CONFLICT (event_id, telegram_id) DO UPDATE SET sent_at = now()
           WHERE calendar_tracking_sent.sent_at IS NULL AND calendar_tracking_sent.attempts < $2
         RETURNING event_id, telegram_id
       )
       SELECT c.telegram_id AS recipient_id, e.id, e.title, e.location, e.starts_at, e.ends_at, e.owner_id
       FROM claimed c JOIN calendar_events e ON e.id = c.event_id`,
      [REMINDER_LEAD_MINUTES, MAX_REMINDER_ATTEMPTS, subscribers],
    );
    return rows.map((row) => ({
      recipientId: row.recipient_id,
      id: row.id,
      title: row.title,
      location: row.location,
      startsAt: new Date(row.starts_at).toISOString(),
      endsAt: new Date(row.ends_at).toISOString(),
      ownerId: row.owner_id,
    }));
  });

/** Отправка не удалась: возвращаем напоминание в очередь и считаем попытку. */
export const releaseTrackingReminder = (eventId: string, recipientId: string) =>
  run(async () => {
    await getPool().query(
      "UPDATE calendar_tracking_sent SET sent_at = NULL, attempts = attempts + 1 WHERE event_id = $1 AND telegram_id = $2",
      [eventId, recipientId],
    );
  });
