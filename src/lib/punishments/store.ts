import type { PoolClient } from "pg";

import { getPeopleSafe } from "@/lib/auth/db";
import { type Person, personFromName } from "@/lib/auth/person";
import { getPool } from "@/lib/db/pool";

import {
  type EvidenceItem,
  isCommandAvailable,
  type MuteChannel,
  needsDecision,
  type PunishmentEvent,
  type PunishmentEventType,
  type PunishmentKind,
  type PunishmentRequest,
  type PunishmentStatus,
  type QueueItem,
} from "./types";
import type { RequestInput } from "./validate";
import { randomUUID } from "node:crypto";

/**
 * Заявки на наказание лежат в Postgres:
 *  - punishment_requests — сами заявки и их текущий статус;
 *  - punishment_events   — журнал действий (подана, взята, одобрена, скопирована команда, выдано...) для истории.
 * Каждое действие над заявкой выполняется в транзакции с блокировкой строки: два администратора не смогут взять
 * одну заявку одновременно, а выдать наказание можно только после одобрения и копирования команды.
 */

export type StoreErrorCode =
  | "not_found"
  | "taken" // заявку уже взял другой администратор или её статус изменился
  | "forbidden" // действие не для этого человека
  | "state" // действие недоступно в текущем статусе
  | "not_copied" // выдача без копирования команды
  | "own" // нельзя рассматривать собственную заявку
  | "database";

export class PunishmentStoreError extends Error {
  constructor(
    readonly code: StoreErrorCode,
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}

const LOCK_ID = 727_007;

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS punishment_requests (
      id             text PRIMARY KEY,
      number         bigserial NOT NULL,
      static_id      text NOT NULL,
      minutes        integer NOT NULL,
      rules          jsonb NOT NULL,
      evidence       jsonb NOT NULL DEFAULT '[]'::jsonb,
      requester_id   text NOT NULL,
      requester_name text NOT NULL,
      status         text NOT NULL DEFAULT 'pending',
      assignee_id    text,
      assignee_name  text,
      claimed_at     timestamptz,
      decision_note  text NOT NULL DEFAULT '',
      copied_at      timestamptz,
      issued_at      timestamptz,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS punishment_events (
      id         bigserial PRIMARY KEY,
      request_id text NOT NULL,
      type       text NOT NULL,
      actor_id   text NOT NULL,
      actor_name text NOT NULL,
      note       text NOT NULL DEFAULT '',
      at         timestamptz NOT NULL DEFAULT now()
    )`);
    // Миграция: вид наказания, тип мута и жалоба на форуме. Старые заявки остаются деморганом (/jail).
    // Колонка minutes хранит срок: минуты для jail и mute, дни для ban и hardban.
    await client.query("ALTER TABLE punishment_requests ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'jail'");
    await client.query("ALTER TABLE punishment_requests ADD COLUMN IF NOT EXISTS mute_channel text");
    await client.query("ALTER TABLE punishment_requests ADD COLUMN IF NOT EXISTS forum text NOT NULL DEFAULT ''");
    await client.query(
      "CREATE INDEX IF NOT EXISTS punishment_requests_status_idx ON punishment_requests (status, created_at)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS punishment_requests_requester_idx ON punishment_requests (requester_id, created_at DESC)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS punishment_requests_assignee_idx ON punishment_requests (assignee_id, status)",
    );
    await client.query("CREATE INDEX IF NOT EXISTS punishment_events_at_idx ON punishment_events (at DESC)");
    await client.query("COMMIT");
  } catch (error) {
    await client
      .query("ROLLBACK")
      .catch((rollbackError) => console.error("[punishments] ROLLBACK failed", rollbackError));
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
    if (error instanceof PunishmentStoreError) throw error;
    throw new PunishmentStoreError("database", error);
  }
}

/* Чтение */

type Row = {
  id: string;
  number: string | number;
  static_id: string;
  minutes: number;
  kind: PunishmentKind;
  mute_channel: MuteChannel | null;
  forum: string;
  rules: string[];
  evidence: EvidenceItem[];
  requester_id: string;
  requester_name: string;
  status: PunishmentStatus;
  assignee_id: string | null;
  assignee_name: string | null;
  claimed_at: string | Date | null;
  decision_note: string;
  copied_at: string | Date | null;
  issued_at: string | Date | null;
  created_at: string | Date;
};

const iso = (value: string | Date | null) => (value === null ? null : new Date(value).toISOString());

const toRequest = (row: Row): PunishmentRequest => ({
  id: row.id,
  number: Number(row.number),
  staticId: row.static_id,
  kind: row.kind,
  muteChannel: row.mute_channel,
  duration: row.minutes,
  forum: row.forum,
  rules: Array.isArray(row.rules) ? row.rules : [],
  evidence: Array.isArray(row.evidence) ? row.evidence : [],
  requesterId: row.requester_id,
  requesterName: row.requester_name,
  requester: personFromName(row.requester_name, row.requester_id),
  status: row.status,
  assigneeId: row.assignee_id,
  assigneeName: row.assignee_name,
  assignee: row.assignee_id && row.assignee_name ? personFromName(row.assignee_name, row.assignee_id) : null,
  claimedAt: iso(row.claimed_at),
  decisionNote: row.decision_note,
  copiedAt: iso(row.copied_at),
  issuedAt: iso(row.issued_at),
  createdAt: new Date(row.created_at).toISOString(),
});

const COLUMNS =
  "id, number, static_id, minutes, kind, mute_channel, forum, rules, evidence, requester_id, requester_name, status, assignee_id, assignee_name, claimed_at, decision_note, copied_at, issued_at, created_at";

/**
 * Заменяет сохранённые на момент заявки имена актуальными данными: Никнейм, Static ID и роль берутся из профилей,
 * поэтому правка профиля сразу видна и в старых заявках. Одним запросом на весь список.
 */
async function withPeople<T extends { requester: Person; assignee: Person | null }>(requests: T[]): Promise<T[]> {
  const ids = requests.flatMap((request) => [request.requester.id, request.assignee?.id ?? ""]);
  const people = await getPeopleSafe(ids);
  return requests.map((request) => ({
    ...request,
    requester: people.get(request.requester.id) ?? request.requester,
    assignee: request.assignee ? (people.get(request.assignee.id) ?? request.assignee) : null,
  }));
}

/** Одна заявка по номеру записи: для журнала аудита (что именно одобрили, отклонили или выдали). */
export const getRequestById = (id: string) =>
  run(async () => {
    const { rows } = await getPool().query<Row>(`SELECT ${COLUMNS} FROM punishment_requests WHERE id = $1`, [id]);
    return rows[0] ? toRequest(rows[0]) : null;
  });

/** Свои заявки хелпера: все статусы, новые сверху. */
export const listMine = (requesterId: string, limit = 100) =>
  run(async () => {
    const { rows } = await getPool().query<Row>(
      `SELECT ${COLUMNS} FROM punishment_requests WHERE requester_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [requesterId, limit],
    );
    return withPeople(rows.map(toRequest));
  });

/** Очередь: свободные заявки. Доказательства не отдаются, только их количество: смотреть их будет тот, кто возьмёт. */
export const listQueue = () =>
  run(async (): Promise<QueueItem[]> => {
    const { rows } = await getPool().query<Row>(
      `SELECT ${COLUMNS} FROM punishment_requests WHERE status = 'pending' ORDER BY created_at ASC LIMIT 200`,
    );
    const requests = await withPeople(rows.map(toRequest));
    return requests.map((request) => {
      return {
        id: request.id,
        number: request.number,
        staticId: request.staticId,
        kind: request.kind,
        muteChannel: request.muteChannel,
        duration: request.duration,
        forum: request.forum,
        rules: request.rules,
        requesterName: request.requesterName,
        requester: request.requester,
        createdAt: request.createdAt,
        evidenceCount: request.evidence.length,
      };
    });
  });

/** Заявки, которые этот администратор взял и ещё не закрыл. Только его блоки: чужие сюда не попадают. */
export const listAssigned = (assigneeId: string) =>
  run(async () => {
    const { rows } = await getPool().query<Row>(
      `SELECT ${COLUMNS} FROM punishment_requests
       WHERE assignee_id = $1 AND status IN ('claimed', 'approved') ORDER BY claimed_at ASC`,
      [assigneeId],
    );
    return withPeople(rows.map(toRequest));
  });

/** Выданные этим администратором и отклонённые им наказания. */
export const listClosedBy = (assigneeId: string, limit = 100) =>
  run(async () => {
    const { rows } = await getPool().query<Row>(
      `SELECT ${COLUMNS} FROM punishment_requests
       WHERE assignee_id = $1 AND status IN ('issued', 'rejected') ORDER BY updated_at DESC LIMIT $2`,
      [assigneeId, limit],
    );
    return withPeople(rows.map(toRequest));
  });

export const listAll = (limit = 500) =>
  run(async () => {
    const { rows } = await getPool().query<Row>(
      `SELECT ${COLUMNS} FROM punishment_requests ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return withPeople(rows.map(toRequest));
  });

/** Журнал действий по всем заявкам, новые сверху. */
export const listEvents = (limit = 1000) =>
  run(async (): Promise<PunishmentEvent[]> => {
    const { rows } = await getPool().query<{
      id: string;
      request_id: string;
      number: string;
      static_id: string;
      type: PunishmentEventType;
      actor_id: string;
      actor_name: string;
      note: string;
      at: string | Date;
    }>(
      `SELECT e.id, e.request_id, r.number, r.static_id, e.type, e.actor_id, e.actor_name, e.note, e.at
       FROM punishment_events e JOIN punishment_requests r ON r.id = e.request_id
       ORDER BY e.at DESC, e.id DESC LIMIT $1`,
      [limit],
    );
    const people = await getPeopleSafe(rows.map((row) => row.actor_id));
    return rows.map((row) => ({
      id: Number(row.id),
      requestId: row.request_id,
      number: Number(row.number),
      staticId: row.static_id,
      type: row.type,
      actorName: row.actor_name,
      actor: people.get(row.actor_id) ?? personFromName(row.actor_name, row.actor_id),
      note: row.note,
      at: new Date(row.at).toISOString(),
    }));
  });

export const countByStatus = () =>
  run(async () => {
    const { rows } = await getPool().query<{ status: PunishmentStatus; n: number }>(
      "SELECT status, count(*)::int AS n FROM punishment_requests GROUP BY status",
    );
    const result: Record<PunishmentStatus, number> = { pending: 0, claimed: 0, approved: 0, issued: 0, rejected: 0 };
    for (const row of rows) result[row.status] = row.n;
    return result;
  });

/* Действия */

type Actor = { id: string; name: string };

const logEvent = (client: PoolClient, requestId: string, type: PunishmentEventType, actor: Actor, note = "") =>
  client.query(
    "INSERT INTO punishment_events (request_id, type, actor_id, actor_name, note) VALUES ($1, $2, $3, $4, $5)",
    [requestId, type, actor.id, actor.name, note],
  );

/** Выполняет действие над заявкой в транзакции с блокировкой строки. check бросает ошибку, если действие недопустимо. */
async function withRequest(
  id: string,
  action: (client: PoolClient, request: PunishmentRequest) => Promise<void>,
): Promise<PunishmentRequest> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<Row>(`SELECT ${COLUMNS} FROM punishment_requests WHERE id = $1 FOR UPDATE`, [
      id,
    ]);
    if (!rows[0]) throw new PunishmentStoreError("not_found");
    await action(client, toRequest(rows[0]));
    const updated = await client.query<Row>(`SELECT ${COLUMNS} FROM punishment_requests WHERE id = $1`, [id]);
    await client.query("COMMIT");
    return toRequest(updated.rows[0]);
  } catch (error) {
    await client
      .query("ROLLBACK")
      .catch((rollbackError) => console.error("[punishments] ROLLBACK failed", rollbackError));
    throw error;
  } finally {
    client.release();
  }
}

export const createRequest = (input: RequestInput, requester: Actor) =>
  run(async () => {
    const id = randomUUID();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<{ number: string }>(
        `INSERT INTO punishment_requests (id, static_id, minutes, kind, mute_channel, forum, rules, evidence, requester_id, requester_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10) RETURNING number`,
        [
          id,
          input.staticId,
          input.duration,
          input.kind,
          input.muteChannel,
          input.forum,
          JSON.stringify(input.rules),
          JSON.stringify(input.evidence),
          requester.id,
          requester.name,
        ],
      );
      await logEvent(client, id, "created", requester);
      await client.query("COMMIT");
      return { id, number: Number(rows[0].number) };
    } catch (error) {
      await client
        .query("ROLLBACK")
        .catch((rollbackError) => console.error("[punishments] ROLLBACK failed", rollbackError));
      throw error;
    } finally {
      client.release();
    }
  });

/** Взять заявку в работу. С этого момента блок есть только у взявшего. */
export const claimRequest = (id: string, admin: Actor) =>
  run(() =>
    withRequest(id, async (client, request) => {
      if (request.requesterId === admin.id) throw new PunishmentStoreError("own");
      if (request.status !== "pending") throw new PunishmentStoreError("taken");
      await client.query(
        `UPDATE punishment_requests SET status = 'claimed', assignee_id = $2, assignee_name = $3, claimed_at = now(), updated_at = now()
         WHERE id = $1`,
        [id, admin.id, admin.name],
      );
      await logEvent(client, id, "claimed", admin);
    }),
  );

/** Вернуть заявку в ��чередь: может взявший её администратор, а Гл.Администратор любую (force). */
export const releaseRequest = (id: string, actor: Actor, force: boolean) =>
  run(() =>
    withRequest(id, async (client, request) => {
      if (request.status !== "claimed" && request.status !== "approved") throw new PunishmentStoreError("state");
      if (request.assigneeId !== actor.id && !force) throw new PunishmentStoreError("forbidden");
      await client.query(
        `UPDATE punishment_requests SET status = 'pending', assignee_id = NULL, assignee_name = NULL, claimed_at = NULL,
           copied_at = NULL, updated_at = now() WHERE id = $1`,
        [id],
      );
      await logEvent(client, id, "released", actor);
    }),
  );

function assertAssignee(request: PunishmentRequest, admin: Actor) {
  if (request.assigneeId !== admin.id) throw new PunishmentStoreError("forbidden");
}

export const approveRequest = (id: string, admin: Actor) =>
  run(() =>
    withRequest(id, async (client, request) => {
      assertAssignee(request, admin);
      if (!needsDecision(request)) throw new PunishmentStoreError("state");
      await client.query("UPDATE punishment_requests SET status = 'approved', updated_at = now() WHERE id = $1", [id]);
      await logEvent(client, id, "approved", admin);
    }),
  );

export const rejectRequest = (id: string, admin: Actor, note: string) =>
  run(() =>
    withRequest(id, async (client, request) => {
      assertAssignee(request, admin);
      if (!needsDecision(request)) throw new PunishmentStoreError("state");
      await client.query(
        "UPDATE punishment_requests SET status = 'rejected', decision_note = $2, copied_at = NULL, updated_at = now() WHERE id = $1",
        [id, note],
      );
      await logEvent(client, id, "rejected", admin, note);
    }),
  );

/** Администратор скопировал команду. Запоминаем: только после этого доступно «Выдал наказание», и после перезагрузки тоже. */
export const markCopied = (id: string, admin: Actor) =>
  run(() =>
    withRequest(id, async (client, request) => {
      assertAssignee(request, admin);
      if (!isCommandAvailable(request)) throw new PunishmentStoreError("state");
      const first = request.copiedAt === null;
      await client.query(
        "UPDATE punishment_requests SET copied_at = COALESCE(copied_at, now()), updated_at = now() WHERE id = $1",
        [id],
      );
      if (first) await logEvent(client, id, "copied", admin);
    }),
  );

/**
 * Администратор указал или поправил жалобу на форуме. Команда от этого меняется, поэтому «скопировано» сбрасывается:
 * чтобы выдать наказание, команду нужно скопировать заново.
 */
export const setForum = (id: string, admin: Actor, forum: string) =>
  run(() =>
    withRequest(id, async (client, request) => {
      assertAssignee(request, admin);
      if (request.status !== "claimed" && request.status !== "approved") throw new PunishmentStoreError("state");
      if (request.forum === forum) return;
      await client.query(
        "UPDATE punishment_requests SET forum = $2, copied_at = NULL, updated_at = now() WHERE id = $1",
        [id, forum],
      );
      await logEvent(client, id, "forum_changed", admin, forum || "жалоба убрана");
    }),
  );

/** Подтверждение выдачи: наказание фиксируется за администратором, у хелпера статус становится «Выдано». */
export const issueRequest = (id: string, admin: Actor) =>
  run(() =>
    withRequest(id, async (client, request) => {
      assertAssignee(request, admin);
      if (!isCommandAvailable(request)) throw new PunishmentStoreError("state");
      if (request.copiedAt === null) throw new PunishmentStoreError("not_copied");
      await client.query(
        "UPDATE punishment_requests SET status = 'issued', issued_at = now(), updated_at = now() WHERE id = $1",
        [id],
      );
      await logEvent(client, id, "issued", admin);
    }),
  );
