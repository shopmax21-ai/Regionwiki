"use server";

import { revalidatePath } from "next/cache";

import { actorOf, recordContentChange } from "@/lib/audit/store";
import { getAdmin, getAdminContext } from "@/lib/auth/admin";
import { setNotifyMedia } from "@/lib/auth/db";
import { addChannel, parseChannelId, parseTwitchLogin, removeChannel, setChannelNotify } from "@/lib/media/channels";
import { invalidateMediaCache } from "@/lib/media/feed";
import { describeTwitchError, isTwitchConfigured, lookupTwitchChannel } from "@/lib/media/twitch";
import type { MediaPlatform } from "@/lib/media/types";
import {
  describeYoutubeError,
  isYoutubeConfigured,
  lookupYoutubeChannel,
  parseYoutubeChannel,
} from "@/lib/media/youtube";

export type MediaActionResult = { ok: true; warning?: string } | { ok: false; error: string };

type ResolvedChannel = { platform: MediaPlatform; login: string; name: string; warning?: string };

const DENIED = { ok: false, error: "Недостаточно прав для управления каналами" } as const;
const DATABASE = { ok: false, error: "База данных недоступна, попробуйте позже" } as const;

function done(warning?: string): MediaActionResult {
  invalidateMediaCache();
  revalidatePath("/media");
  return { ok: true, warning };
}

/** Twitch: проверяем канал и берём его настоящее имя. Если Twitch не отвечает, канал всё равно можно добавить. */
async function resolveTwitch(input: unknown): Promise<ResolvedChannel | { error: string }> {
  const login = parseTwitchLogin(input);
  if (!login) return { error: "Укажите логин канала на Twitch или ссылку вида twitch.tv/логин" };

  let name = login;
  let canonical = login;
  let warning: string | undefined;
  if (isTwitchConfigured()) {
    try {
      const info = await lookupTwitchChannel(login);
      if (!info) return { error: "Канал с таким логином на Twitch не найден" };
      name = info.name;
      canonical = info.login;
    } catch (error) {
      // Сбой Twitch не мешает добавить канал: проверка нужна только ради настоящего имени, оно подтянется из эфира
      console.error("[media] Не удалось проверить канал на Twitch", error instanceof Error ? error.message : error);
      warning = `Канал добавлен без проверки. ${describeTwitchError(error)}`;
    }
  }
  return { platform: "twitch", login: canonical, name, warning };
}

/** YouTube: нужен ID канала (UC...). По @имени и ссылкам его находит YouTube Data API. */
async function resolveYoutube(input: unknown): Promise<ResolvedChannel | { error: string }> {
  const query = parseYoutubeChannel(input);
  if (!query) {
    return {
      error: "Укажите ссылку на канал YouTube (youtube.com/@имя или youtube.com/channel/UC...), @имя или ID канала",
    };
  }

  if (!isYoutubeConfigured()) {
    // Без ключа канал можно добавить только по ID: имени и проверки не будет, они подтянутся после настройки ключа
    if (query.kind !== "id")
      return {
        error:
          "Чтобы найти канал по @имени, задайте YOUTUBE_API_KEY. Или укажите ссылку вида youtube.com/channel/UC...",
      };
    return {
      platform: "youtube",
      login: query.value,
      name: query.value,
      warning: "Канал добавлен без проверки: не задан YOUTUBE_API_KEY, эфиры YouTube пока не отслеживаются.",
    };
  }

  try {
    const info = await lookupYoutubeChannel(query);
    if (!info) return { error: "Такой канал на YouTube не найден" };
    return { platform: "youtube", login: info.id, name: info.name };
  } catch (error) {
    console.error("[media] Не удалось проверить канал на YouTube", error instanceof Error ? error.message : error);
    return { error: describeYoutubeError(error) };
  }
}

/** Добавить канал в список отслеживаемых. Нужно право «Управление каналами «Медиа»». */
export async function addChannelAction(input: unknown): Promise<MediaActionResult> {
  const admin = await getAdmin("media.manage");
  if (!admin) return DENIED;

  const fields = (typeof input === "object" && input !== null ? input : {}) as {
    channel?: unknown;
    notify?: unknown;
    platform?: unknown;
  };
  const notify = fields.notify !== false;
  const resolved =
    fields.platform === "youtube" ? await resolveYoutube(fields.channel) : await resolveTwitch(fields.channel);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  try {
    const added = await addChannel(
      { platform: resolved.platform, login: resolved.login, name: resolved.name, notify },
      admin.id,
    );
    if (!added) return { ok: false, error: "Этот канал уже в списке" };
    await recordContentChange(actorOf(admin), "media_channel", "created", { id: resolved.login, label: resolved.name });
  } catch (error) {
    console.error("[media] Не удалось добавить канал", error);
    return DATABASE;
  }
  return done(resolved.warning);
}

export async function removeChannelAction(login: unknown): Promise<MediaActionResult> {
  const admin = await getAdmin("media.manage");
  if (!admin) return DENIED;
  const parsed = parseChannelId(login);
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
  const parsed = parseChannelId(login);
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
