import { type AuditActor, recordAudit } from "@/lib/audit/store";

import { getRequestById } from "./store";
import { isDaysKind, KIND_SHORT, type PunishmentRequest } from "./types";

function requestDetails(request: PunishmentRequest): Record<string, string> {
  return {
    Вид: KIND_SHORT[request.kind],
    Срок: `${request.duration} ${isDaysKind(request.kind) ? "дн." : "мин."}`,
    "Пункты правил": request.rules.join(", ") || "—",
  };
}

/**
 * Решение по заявке попадает в журнал аудита. Сбой журнала не отменяет решение.
 * Общий код для сайта и оверлея: действие в приложении выглядит в журнале так же, как на сайте.
 */
export async function auditDecision(
  actor: AuditActor,
  id: string,
  decision: "approved" | "rejected" | "issued",
  note?: string,
): Promise<void> {
  try {
    const request = await getRequestById(id);
    const verbs = { approved: "Одобрена", rejected: "Отклонена", issued: "Выдано наказание по" } as const;
    const number = request ? `№${request.number}` : id;
    const label = request
      ? `заявка ${number}, ${KIND_SHORT[request.kind]}, ID ${request.staticId}`
      : `заявка ${number}`;
    await recordAudit(actor, {
      category: "punishments",
      action: `punishment.${decision}`,
      severity: "normal",
      summary: decision === "issued" ? `Выдано наказание: ${label}` : `${verbs[decision]} ${label}`,
      target: { type: "punishment", id, label },
      details: { ...(request ? requestDetails(request) : {}), ...(note ? { Причина: note } : {}) },
    });
  } catch (error) {
    console.error("[punishments] Не удалось записать решение в журнал", error);
  }
}
