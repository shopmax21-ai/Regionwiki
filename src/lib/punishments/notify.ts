import { type AuthConfig, getAuthConfig } from "@/lib/auth/config";
import { getGroupPermissions, listAdmins, listUserOverrides } from "@/lib/auth/db";
import { effectivePermissions } from "@/lib/auth/groups";
import { sendMessage } from "@/lib/auth/telegram";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Кому слать уведомление о новой заявке на наказание: всем, у кого есть право «Рассмотрение заявок на наказание»
 * (по умолчанию Мл.администраторы, Администраторы и Гл.Администраторы, то есть все выше хелпера). Сам подавший заявку
 * не получает. Гл.Администраторы из TELEGRAM_ADMIN_IDS, ещё не входившие на сайт, получают уведомление тоже.
 */
export async function reviewerRecipients(config: AuthConfig, excludeId: string): Promise<string[]> {
  const recipients = new Set<string>();
  const known = new Set<string>();

  try {
    const [permissions, overrides] = await Promise.all([getGroupPermissions(), listUserOverrides()]);
    for (const admin of await listAdmins()) {
      known.add(admin.telegramId);
      const group = config.adminIds.includes(admin.telegramId) ? "chief" : admin.adminGroup;
      if (!group) continue;
      const own =
        group === "chief"
          ? permissions[group]
          : effectivePermissions(permissions[group], overrides.get(admin.telegramId));
      if (own.includes("punishments.review")) recipients.add(admin.telegramId);
    }
  } catch (error) {
    console.error("[punishments] Не удалось определить получателей уведомлений, шлём Гл.Администраторам", error);
  }

  for (const id of config.adminIds) if (!known.has(id)) recipients.add(id);
  recipients.delete(excludeId);
  return [...recipients];
}

export type NewRequestInfo = {
  number: number;
  requesterId: string;
  requesterName: string;
  staticId: string;
  minutes: number;
  rules: string[];
  evidenceCount: number;
};

export function newRequestText(info: NewRequestInfo): string {
  const evidence = info.evidenceCount > 0 ? `есть (${info.evidenceCount})` : "нет";
  return [
    `🆕 <b>Заявка на наказание №${info.number}</b>`,
    "",
    `👤 Хелпер: ${escapeHtml(info.requesterName)}`,
    `🆔 Статик: <code>${escapeHtml(info.staticId)}</code>`,
    `⏱ Время: ${info.minutes} мин`,
    `📜 Пункты: ${info.rules.map(escapeHtml).join(", ")}`,
    `📎 Доказательства: ${evidence}`,
    "",
    "Откройте раздел «Рассмотрение наказаний» на сайте и возьмите заявку в работу. Её увидит только тот, кто возьмёт.",
  ].join("\n");
}

/** Рассылает уведомление всем, кто может рассматривать заявки. Ошибки Telegram не мешают подаче заявки. */
export async function notifyReviewers(info: NewRequestInfo): Promise<number> {
  const config = getAuthConfig();
  if (!config) return 0;

  const text = newRequestText(info);
  const recipients = await reviewerRecipients(config, info.requesterId);
  const results = await Promise.allSettled(recipients.map((id) => sendMessage(config, id, text)));
  return results.filter((result) => result.status === "fulfilled" && result.value).length;
}
