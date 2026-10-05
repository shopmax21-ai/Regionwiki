/** Общие типы заявок на наказание. Файл без серверного кода: его можно импортировать и в клиентских компонентах. */

export const PUNISHMENT_LIMITS = {
  staticMaxDigits: 9,
  minMinutes: 1,
  maxMinutes: 10_000,
  maxRules: 5,
  maxEvidence: 6,
  linkMax: 300,
  noteMax: 300,
} as const;

/**
 * pending — ждёт администратора; claimed — взят в работу; approved — одобрен (есть доказательства, можно выдавать);
 * issued — наказание выдано; rejected — отклонено.
 */
export type PunishmentStatus = "pending" | "claimed" | "approved" | "issued" | "rejected";

export type EvidenceItem = { type: "link" | "image"; url: string };

export type PunishmentRequest = {
  id: string;
  number: number;
  staticId: string;
  minutes: number;
  rules: string[];
  evidence: EvidenceItem[];
  requesterId: string;
  requesterName: string;
  status: PunishmentStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  claimedAt: string | null;
  decisionNote: string;
  /** Администратор скопировал команду: только после этого можно подтвердить выдачу */
  copiedAt: string | null;
  issuedAt: string | null;
  createdAt: string;
};

/** Заявка в очереди для всех, кто может рассматривать: без самих доказательств, только их количество. */
export type QueueItem = Pick<
  PunishmentRequest,
  "id" | "number" | "staticId" | "minutes" | "rules" | "requesterName" | "createdAt"
> & { evidenceCount: number };

export type PunishmentEventType = "created" | "claimed" | "released" | "approved" | "rejected" | "copied" | "issued";

export const EVENT_LABELS: Record<PunishmentEventType, string> = {
  created: "Заявка подана",
  claimed: "Взята в работу",
  released: "Возвращена в очередь",
  approved: "Одобрена",
  rejected: "Отклонена",
  copied: "Команда скопирована",
  issued: "Наказание выдано",
};

export type PunishmentEvent = {
  id: number;
  requestId: string;
  number: number;
  staticId: string;
  type: PunishmentEventType;
  actorName: string;
  note: string;
  at: string;
};

/**
 * Команда выдачи Деморгана: «/jail 5476 60 ОП 4.9». Формат команды определяется только здесь.
 * Несколько пунктов правил идут через запятую.
 */
export const buildCommand = (request: Pick<PunishmentRequest, "staticId" | "minutes" | "rules">): string =>
  `/jail ${request.staticId} ${request.minutes} ${request.rules.join(", ")}`;

/** Команду можно показывать, когда заявка одобрена или доказательств нет (тогда одобрение не требуется). */
export const isCommandAvailable = (request: Pick<PunishmentRequest, "status" | "evidence">): boolean =>
  request.status === "approved" || (request.status === "claimed" && request.evidence.length === 0);

/** Нужно ли решение «одобрить / отклонить»: только когда есть что проверять. */
export const needsDecision = (request: Pick<PunishmentRequest, "status" | "evidence">): boolean =>
  request.status === "claimed" && request.evidence.length > 0;

export type HelperStatus = { label: string; tone: "waiting" | "progress" | "done" | "rejected" };

/** Статус глазами хелпера: «одобрена» и «взята» для него одно и то же, «на рассмотрении». */
export function helperStatus(request: Pick<PunishmentRequest, "status">): HelperStatus {
  switch (request.status) {
    case "pending":
      return { label: "Ожидает администратора", tone: "waiting" };
    case "claimed":
    case "approved":
      return { label: "На рассмотрении", tone: "progress" };
    case "issued":
      return { label: "Выдано", tone: "done" };
    case "rejected":
      return { label: "Отклонено", tone: "rejected" };
  }
}

export const STATUS_LABELS: Record<PunishmentStatus, string> = {
  pending: "Ожидает",
  claimed: "В работе",
  approved: "Одобрена",
  issued: "Выдано",
  rejected: "Отклонено",
};

export type RulePointHit = { label: string; text: string; punishments: string[] };
