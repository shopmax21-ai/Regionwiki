/** Раздел «Медиа-PR»: общие типы сервера и браузера. Серверного кода здесь быть не должно. */

export const mediaPrPlatforms = ["twitch", "youtube", "tiktok", "telegram", "vk", "other"] as const;
export type MediaPrPlatform = (typeof mediaPrPlatforms)[number];

export const mediaPrPlatformLabels: Record<MediaPrPlatform, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  tiktok: "TikTok",
  telegram: "Telegram",
  vk: "VK",
  other: "Другая",
};

export const mediaPrStatuses = ["active", "talks", "paused"] as const;
export type MediaPrStatus = (typeof mediaPrStatuses)[number];

export const mediaPrStatusLabels: Record<MediaPrStatus, string> = {
  active: "Сотрудничаем",
  talks: "Переговоры",
  paused: "Пауза",
};

export const MEDIA_PR_LIMITS = {
  name: 80,
  url: 300,
  contact: 120,
  note: 500,
  info: 6000,
  audienceMax: 1_000_000_000,
} as const;

/** Запись таблицы медиа: стример, ютубер или сообщество, с которым работает проект. */
export type MediaPrEntry = {
  id: string;
  name: string;
  platform: MediaPrPlatform;
  /** Ссылка на канал или страницу. Пусто, если её нет */
  url: string;
  /** Как связаться: Telegram, Discord и т. п. */
  contact: string;
  /** Подписчики или средний онлайн. null, если не указано */
  audience: number | null;
  status: MediaPrStatus;
  note: string;
  updatedAt: string;
};

export type MediaPrInput = Omit<MediaPrEntry, "id" | "updatedAt">;

/** Справка раздела, пока администрация не написала свою. Правится прямо на странице. */
export const DEFAULT_MEDIA_PR_INFO = `Здесь собраны стримеры, ютуберы и сообщества, с которыми работает проект: кто они, где их найти и на каком этапе сотрудничество.

Чем занимается Медиа-PR
• Ведёт таблицу медиа: площадка, ссылка, аудитория, контакты и статус сотрудничества.
• Следит за трансляциями в разделе «Медиа»: каналы на Twitch и YouTube, оповещение в Telegram о начале эфира.
• Поддерживает связь с медиа и передаёт им важные новости проекта.

Как пользоваться таблицей
• Статус «Переговоры» ставьте, пока договорённости нет, «Сотрудничаем» — когда она есть, «Пауза» — если сотрудничество приостановлено.
• Если у медиа есть стримы, добавьте его канал в «Медиа» (кнопка «Каналы»): эфиры появятся там сами.
• Контакты и заметки видят только сотрудники с доступом к этому разделу.`;
