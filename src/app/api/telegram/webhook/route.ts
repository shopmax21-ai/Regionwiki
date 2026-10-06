import { type NextRequest, NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit/store";
import { canUserDecideAccess } from "@/lib/auth/admin";
import { generateCode, hashCode, hashToken, isAttemptToken } from "@/lib/auth/attempt";
import { getAuthConfig } from "@/lib/auth/config";
import { bindAttempt, decideUser, getUser } from "@/lib/auth/db";
import { authErrorResponse } from "@/lib/auth/errors";
import { personPlainText } from "@/lib/auth/person";
import {
  answerCallback,
  codeMessage,
  editMessage,
  notifyUserDecision,
  sameSecret,
  sendMessage,
  userLabel,
} from "@/lib/auth/telegram";

type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string };
type Update = {
  message?: { message_id: number; text?: string; chat: { id: number; type: string }; from?: TelegramUser };
  callback_query?: {
    id: string;
    data?: string;
    from: TelegramUser;
    message?: { message_id: number; chat: { id: number }; text?: string };
  };
};

const displayName = (user: TelegramUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || String(user.id);

/**
 * Вебхук бота. Включается один раз:
 * curl "https://api.telegram.org/bot<TOKEN>/setWebhook" -d url=https://<сайт>/api/telegram/webhook -d secret_token=<TELEGRAM_WEBHOOK_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    return await handleUpdate(request);
  } catch (error) {
    // Отдаём 500, чтобы Telegram повторил доставку, когда база снова станет доступна.
    return authErrorResponse("telegram webhook", error);
  }
}

async function handleUpdate(request: NextRequest) {
  const config = getAuthConfig();
  if (!config) return NextResponse.json({ ok: false }, { status: 503 });
  if (!sameSecret(request.headers.get("x-telegram-bot-api-secret-token"), config.webhookSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as Update | null;
  if (!update) return NextResponse.json({ ok: true });

  /* /start <токен>: бот генерирует код и присылает его в чат */
  const message = update.message;
  if (message?.from && message.chat.type === "private" && message.text?.startsWith("/start")) {
    const payload = message.text.split(/\s+/)[1] ?? "";

    if (!isAttemptToken(payload)) {
      await sendMessage(
        config,
        message.chat.id,
        "👋 Это бот входа в <b>Region WIKI</b>.\nНажмите «Войти через Telegram» на сайте, и бот пришлёт одноразовый код.",
      );
      return NextResponse.json({ ok: true });
    }

    const tokenHash = hashToken(payload);
    const code = generateCode();
    const bound = await bindAttempt({
      tokenHash,
      telegramId: String(message.from.id),
      name: displayName(message.from),
      username: message.from.username ?? null,
      codeHash: hashCode(code, tokenHash, config.secret),
    });

    await sendMessage(
      config,
      message.chat.id,
      bound
        ? codeMessage(code)
        : "⌛ Эта ссылка уже не работает: время вышло или вход начат с другого аккаунта. Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.",
    );
    return NextResponse.json({ ok: true });
  }

  /* Кнопки «Одобрить» / «Отклонить» у администратора */
  const callback = update.callback_query;
  if (callback?.data) {
    const [action, targetId] = callback.data.split(":");
    const adminId = String(callback.from.id);

    if (!(await canUserDecideAccess(adminId))) {
      await answerCallback(config, callback.id, "Только для администраторов");
      return NextResponse.json({ ok: true });
    }
    if ((action !== "ap" && action !== "rj") || !targetId) return NextResponse.json({ ok: true });

    const approved = action === "ap";
    const user = await decideUser(targetId, approved ? "approved" : "rejected", adminId);
    if (!user) {
      await answerCallback(config, callback.id, "Заявка не найдена");
      return NextResponse.json({ ok: true });
    }

    // Решение из бота попадает в журнал так же, как решение на сайте
    const decider = await getUser(adminId).catch(() => null);
    const label = personPlainText(user);
    await recordAudit(
      { id: adminId, name: decider ? personPlainText(decider) : displayName(callback.from) },
      {
        category: "access",
        action: approved ? "access.approved" : "access.rejected",
        severity: "important",
        summary: `${approved ? "Одобрен" : "Отклонён"} доступ: ${label}`,
        target: { type: "user", id: user.telegramId, label },
        details: { Источник: "кнопка в Telegram" },
      },
    );

    await answerCallback(config, callback.id, approved ? "Доступ одобрен" : "Заявка отклонена");
    if (callback.message) {
      const verdict = approved ? "✅ Одобрено" : "⛔ Отклонено";
      await editMessage(
        config,
        callback.message.chat.id,
        callback.message.message_id,
        `${verdict}\n\n${userLabel(user)}`,
      );
    }
    await notifyUserDecision(config, user.telegramId, approved);
  }

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
