"use server";

import { revalidatePath } from "next/cache";

import { actorOf, recordContentChange } from "@/lib/audit/store";
import { getAdmin, getAdminContext } from "@/lib/auth/admin";
import { setNotifyMedia } from "@/lib/auth/db";
import { addChannel, parseTwitchLogin, removeChannel, setChannelNotify } from "@/lib/media/channels";
import { describeTwitchError, invalidateMediaCache, isTwitchConfigured, lookupTwitchChannel } from "@/lib/media/twitch";

export type MediaActionResult = { ok: true; warning?: string } | { ok: false; error: string };

const DENIED = { ok: false, error: "Недостаточно прав для управления каналами" } as const;
const DATABASE = { ok: false, error: "База данных недоступна, попробуйте позже" } as const;

function done(warning?: string): MediaActionResult {
  invalidateMediaCache();
  revalidatePath("/media");
  return { ok: true, warning };
}

/** Добавить канал в список отслеживаемых. Нужно право «Управление каналами «Медиа»». */
export async function addChannelAction(input: unknown): Promise<MediaActionResult> {
  const admin = await getAdmin("media.manage");
  if (!admin) return DENIED;

  const fields = (typeof input === "object" && input !== null ? input : {}) as { channel?: unknown; notify?: unknown };
  const login = parseTwitchLogin(fields.channel);
  if (!login) return { ok: false, error: "Укажите логин канала на Twitch или ссылку вида twitch.tv/логин" };
  const notify = fields.notify !== false;

  // Если ключи Twitch заданы, проверяем, что канал существует, и берём его настоящее имя
  let name = login;
  let canonical = login;
  let warning: string | undefined;
  if (isTwitchConfigured()) {
    try {
      const info = await lookupTwitchChannel(login);
      if (!info) return { ok: false, error: "Канал с таким логином на Twitch не найден" };
      name = info.name;
      canonical = info.login;
    } catch (error) {
      // Сбой Twitch не мешает добавить канал: проверка нужна только ради настоящего имени, оно подтянется из эфира
      console.error("[media] Не удалось проверить канал на Twitch", error instanceof Error ? error.message : error);
      warning = `Канал добавлен без проверки. ${describeTwitchError(error)}`;
    }
  }

  try {
    const added = await addChannel({ login: canonical, name, notify }, admin.id);
    if (!added) return { ok: false, error: "Этот канал уже в списке" };
    await recordContentChange(actorOf(admin), "media_channel", "created", { id: canonical, label: name });
  } catch (error) {
    console.error("[media] Не удалось добавить канал", error);
    return DATABASE;
  }
  return done(warning);
}

export async function removeChannelAction(login: unknown): Promise<MediaActionResult> {
  const admin = await getAdmin("media.manage");
  if (!admin) return DENIED;
  const parsed = parseTwitchLogin(login);
  if (!parsed) return { ok: false, error: "Неизвестный канал" };

  try {
    const name = await removeChannel(parsed);
    if (name === null) return { ok: false, error: "Канал не найден, возможно, его уже удалили" };
    await recordContentChange(actorOf(admin), "media_channel", "deleted", { id: parsed, label: name });
  } catch (error) {
    console.error("[media] Не удалось удалить канал", error);
    return DATABASE;
  }
  return done();
}

/** Включить или выключить оповещение в Telegram о начале трансляции этого канала. */
export async function setChannelNotifyAction(login: unknown, notify: unknown): Promise<MediaActionResult> {
  const admin = await getAdmin("media.manage");
  if (!admin) return DENIED;
  const parsed = parseTwitchLogin(login);
  if (!parsed || typeof notify !== "boolean") return { ok: false, error: "Неизвестное значение" };

  try {
    const name = await setChannelNotify(parsed, notify);
    if (name === null) return { ok: false, error: "Канал не найден, возможно, его уже удалили" };
    await recordContentChange(
      actorOf(admin),
      "media_channel",
      "updated",
      { id: parsed, label: name },
      {
        Оповещение: notify ? "включено" : "выключено",
      },
    );
  } catch (error) {
    console.error("[media] Не удалось изменить канал", error);
    return DATABASE;
  }
  return done();
}

/** Личная настройка администратора: получать ли в Telegram сообщения о начале трансляций. */
export async function setMediaNotificationsAction(enabled: unknown): Promise<MediaActionResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: "Настройка доступна администраторам" };
  if (typeof enabled !== "boolean") return { ok: false, error: "Неизвестное значение" };

  try {
    await setNotifyMedia(admin.id, enabled);
  } catch (error) {
    console.error("[media] Не удалось сохранить настройку оповещений", error);
    return DATABASE;
  }
  revalidatePath("/media");
  return { ok: true };
}
