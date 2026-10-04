import { type AuthConfig, CODE_LENGTH, CODE_TTL_SECONDS, TELEGRAM_API_URL } from "./config";
import { type DbUser, getGroupPermissions, listAdmins, listUserOverrides } from "./db";
import { effectivePermissions } from "./groups";
import { createHmac, timingSafeEqual } from "node:crypto";

type InlineButton = { text: string; callback_data: string };

async function call(config: AuthConfig, method: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API_URL}/bot${config.botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) console.error(`[auth] Telegram ${method} responded with HTTP ${res.status}`);
    return res.ok;
  } catch (error) {
    // Токен бота в URL, поэтому логируем только метод и саму ошибку.
    console.error(`[auth] Telegram ${method} request failed`, error);
    return false;
  }
}

export const sendMessage = (config: AuthConfig, chatId: string | number, text: string, buttons?: InlineButton[]) =>
  call(config, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    protect_content: true,
    ...(buttons ? { reply_markup: { inline_keyboard: [buttons] } } : {}),
  });

export const editMessage = (config: AuthConfig, chatId: string | number, messageId: number, text: string) =>
  call(config, "editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" });

export const answerCallback = (config: AuthConfig, id: string, text: string) =>
  call(config, "answerCallbackQuery", { callback_query_id: id, text });

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function codeMessage(code: string): string {
  return [
    "🔐 <b>Код входа в Region WIKI</b>",
    "",
    `<code>${code}</code>`,
    "",
    `Введите его на сайте. Код действует ${CODE_TTL_SECONDS / 60} минут и состоит из ${CODE_LENGTH} цифр.`,
    "Если вы не входили на сайт, проигнорируйте сообщение. Никому не сообщайте этот код.",
  ].join("\n");
}

export const userLabel = (user: Pick<DbUser, "name" | "username" | "telegramId">) =>
  `${escapeHtml(user.name)}${user.username ? ` (@${escapeHtml(user.username)})` : ""} · ID ${user.telegramId}`;

/**
 * Кому слать уведомление о новой заявке: администраторам с правом «Одобрение доступа», которые не выключили
 * уведомления в профиле. Администраторы из TELEGRAM_ADMIN_IDS, ещё не входившие на сайт, получают их по умолчанию.
 */
export async function requestRecipients(config: AuthConfig): Promise<string[]> {
  const recipients = new Set<string>();
  const known = new Set<string>();

  try {
    const [permissions, overrides] = await Promise.all([getGroupPermissions(), listUserOverrides()]);
    for (const admin of await listAdmins()) {
      known.add(admin.telegramId);
      const group = config.adminIds.includes(admin.telegramId) ? "chief" : admin.adminGroup;
      if (!group || !admin.notifyRequests) continue;
      const own =
        group === "chief"
          ? permissions[group]
          : effectivePermissions(permissions[group], overrides.get(admin.telegramId));
      if (own.includes("access.decide")) recipients.add(admin.telegramId);
    }
  } catch (error) {
    console.error("[auth] Не удалось определить получателей уведомлений, шлём администраторам из настроек", error);
  }

  for (const id of config.adminIds) if (!known.has(id)) recipients.add(id);
  return [...recipients];
}

/** Новая заявка уходит администраторам с кнопками «Одобрить» и «Отклонить». */
export async function notifyAdminsAboutRequest(config: AuthConfig, user: DbUser) {
  const text = `🆕 <b>Новая заявка на доступ</b>\n\n${userLabel(user)}`;
  await Promise.allSettled(
    (await requestRecipients(config)).map((adminId) =>
      sendMessage(config, adminId, text, [
        { text: "✅ Одобрить", callback_data: `ap:${user.telegramId}` },
        { text: "⛔ Отклонить", callback_data: `rj:${user.telegramId}` },
      ]),
    ),
  );
}

export const notifyUserDecision = (config: AuthConfig, telegramId: string, approved: boolean) =>
  sendMessage(
    config,
    telegramId,
    approved
      ? "✅ <b>Доступ к Region WIKI одобрен.</b>\nОткройте сайт: страница ожидания обновится сама."
      : "⛔ Администратор отклонил заявку на доступ к Region WIKI.",
  );

/** Сравнение секрета вебхука за постоянное время. */
export function sameSecret(a: string | null, b: string): boolean {
  if (!a) return false;
  const left = createHmac("sha256", "cmp").update(a).digest();
  const right = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(left, right);
}
