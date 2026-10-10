/** Трансляция для раздела «Медиа». Общие типы сервера и браузера: серверного кода здесь быть не должно. */
export type MediaStream = {
  /** ID трансляции на Twitch */
  id: string;
  /** Логин канала (для ссылки и плеера) */
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
  /** Адрес канала на Twitch */
  url: string;
  /** Канал добавлен администрацией в список отслеживаемых */
  tracked: boolean;
};

/** Канал из списка, за которым следит администрация */
export type TrackedChannel = {
  login: string;
  name: string;
  /** Присылать администраторам сообщение в Telegram, когда канал начинает трансляцию */
  notify: boolean;
  url: string;
};

export type MediaResponse = {
  /** ok — данные есть (возможно, пустой список), unconfigured — не заданы ключи Twitch, error — Twitch недоступен */
  status: "ok" | "unconfigured" | "error";
  streams: MediaStream[];
  /** Все отслеживаемые каналы, в том числе те, что сейчас не в эфире */
  channels: TrackedChannel[];
  /** ISO-время последней успешной проверки Twitch */
  updatedAt: string | null;
  /** Почему Twitch недоступен (для администрации): неверные ключи, нет сети и т. п. */
  problem?: string;
  /** Показаны данные из кэша, потому что свежие получить не удалось */
  stale?: boolean;
};
