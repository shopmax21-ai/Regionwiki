/** Трансляция для раздела «Медиа». Общие типы сервера и браузера: серверного кода здесь быть не должно. */
export type MediaPlatform = "twitch" | "youtube";

export const platformLabels: Record<MediaPlatform, string> = { twitch: "Twitch", youtube: "YouTube" };

export type MediaStream = {
  platform: MediaPlatform;
  /** ID трансляции: на YouTube это же ID видео для плеера */
  id: string;
  /** Идентификатор канала: логин на Twitch (для ссылки и плеера) или ID канала на YouTube (UC...) */
  login: string;
  /** Отображаемое имя стримера */
  name: string;
  title: string;
  game: string;
  language: string;
  viewers: number;
  /** ISO-время начала эфира */
  startedAt: string;
  /** Аватарка канала или null, если Twitch её не отдал */
  avatar: string | null;
  /** Адрес трансляции */
  url: string;
  /** Канал добавлен администрацией в список отслеживаемых */
  tracked: boolean;
};

/** Канал из списка, за которым следит администрация */
export type TrackedChannel = {
  platform: MediaPlatform;
  /** Логин на Twitch или ID канала на YouTube (UC...) */
  login: string;
  name: string;
  /** Присылать администраторам сообщение в Telegram, когда канал начинает трансляцию */
  notify: boolean;
  url: string;
};

export type MediaResponse = {
  /** ok — данные есть (возможно, пустой список), unconfigured — не заданы ключи Twitch и YouTube, error — площадки недоступны */
  status: "ok" | "unconfigured" | "error";
  streams: MediaStream[];
  /** Все отслеживаемые каналы, в том числе те, что сейчас не в эфире */
  channels: TrackedChannel[];
  /** ISO-время последней успешной проверки */
  updatedAt: string | null;
  /** Почему данные недоступны (для администрации): неверные ключи, нет сети и т. п. */
  problem?: string;
  /** Сбои одной из площадок при работающей другой (для администрации) */
  warnings?: string[];
  /** Показаны данные из кэша, потому что свежие получить не удалось */
  stale?: boolean;
};

/** Ключ канала, одинаковый на сервере и в браузере. ID на YouTube чувствителен к регистру, логин Twitch нет. */
export const channelKey = (item: { platform: MediaPlatform; login: string }) =>
  `${item.platform}:${item.platform === "twitch" ? item.login.toLowerCase() : item.login}`;
