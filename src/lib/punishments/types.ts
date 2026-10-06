/** Общие типы заявок на наказание. Файл без серверного кода: его можно импортировать и в клиентских компонентах. */

export const PUNISHMENT_LIMITS = {
  staticMaxDigits: 9,
  minMinutes: 1,
  maxMinutes: 10_000,
  minDays: 1,
  maxDays: 3650,
  maxRules: 5,
  maxEvidence: 6,
  linkMax: 300,
  noteMax: 300,
  forumMax: 60,
} as const;

/** Вид наказания: определяет команду и единицу срока (минуты или дни). */
export type PunishmentKind = "jail" | "mute" | "ban" | "hardban";

/** Канал мута: чат или голосовой. Нужен только для kind = "mute". */
export type MuteChannel = "chat" | "voice";

export const PUNISHMENT_KINDS: PunishmentKind[] = ["jail", "mute", "ban", "hardban"];
export const MUTE_CHANNELS: MuteChannel[] = ["chat", "voice"];

export const KIND_LABELS: Record<PunishmentKind, string> = {
  jail: "Деморган (/jail)",
  mute: "Мут (/mute)",
  ban: "Бан (/ban)",
  hardban: "Хардбан (/hardban)",
};

/** Короткое название вида для таблиц и уведомлений. */
export const KIND_SHORT: Record<PunishmentKind, string> = {
  jail: "Деморган",
  mute: "Мут",
  ban: "Бан",
  hardban: "Хардбан",
};

export const MUTE_CHANNEL_LABELS: Record<MuteChannel, string> = { chat: "Чат", voice: "Голосовой" };

/** Бан и хардбан выдаются в днях, деморган и мут в минутах. */
export const isDaysKind = (kind: PunishmentKind): boolean => kind === "ban" || kind === "hardban";

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
  kind: PunishmentKind;
  /** Только для мута: chat или voice, для остальных видов null */
  muteChannel: MuteChannel | null;
  /** Срок: минуты для jail и mute, дни для ban и hardban (см. isDaysKind) */
  duration: number;
  /** Название жалобы на форуме, дописывается в конец команды. Пустая строка, если не указано */
  forum: string;
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
  "id" | "number" | "staticId" | "kind" | "muteChannel" | "duration" | "forum" | "rules" | "requesterName" | "createdAt"
> & { evidenceCount: number };

export type PunishmentEventType =
  | "created"
  | "claimed"
  | "released"
  | "approved"
  | "rejected"
  | "copied"
  | "issued"
  | "forum_changed";

export const EVENT_LABELS: Record<PunishmentEventType, string> = {
  created: "Заявка подана",
  claimed: "Взята в работу",
  released: "Возвращена в очередь",
  approved: "Одобрена",
  rejected: "Отклонена",
  copied: "Команда скопирована",
  issued: "Наказание выдано",
  forum_changed: "Изменена жалоба на форуме",
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
 * Команда выдачи наказания. Формат команды определяется только здесь:
 *  - «/jail 5476 60 ОП 4.9»
 *  - «/mute voice 5443 60 ОП 3.11» (chat или voice)
 *  - «/ban 5443 7 ОП 3.11» и «/hardban 5443 30 ОП 3.11» (срок в днях)
 * Несколько пунктов правил идут через запятую. Если указана жалоба на форуме, она дописывается в конец:
 * «/mute voice 5443 60 ОП 3.11 Garik-0018».
 */
export const buildCommand = (
  request: Pick<PunishmentRequest, "staticId" | "kind" | "muteChannel" | "duration" | "forum" | "rules">,
): string => {
  const head = request.kind === "mute" ? `/mute ${request.muteChannel ?? "chat"}` : `/${request.kind}`;
  const base = `${head} ${request.staticId} ${request.duration} ${request.rules.join(", ")}`;
  return request.forum ? `${base} ${request.forum}` : base;
};

/** «60 мин», «7 дн.»: срок с единицей измерения для таблиц. */
export const durationText = (request: Pick<PunishmentRequest, "kind" | "duration">): string => {
  if (isDaysKind(request.kind)) return `${request.duration} дн.`;
  return `${request.duration} мин`;
};

/** «Мут (голосовой)», «Бан»: вид наказания для таблиц. */
export const kindText = (request: Pick<PunishmentRequest, "kind" | "muteChannel">): string =>
  request.kind === "mute" && request.muteChannel
    ? `${KIND_SHORT.mute} (${MUTE_CHANNEL_LABELS[request.muteChannel].toLowerCase()})`
    : KIND_SHORT[request.kind];

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
