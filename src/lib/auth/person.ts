import type { AdminGroup } from "./groups";

/**
 * Человек для отображения на сайте: «(бейдж роли) Никнейм (ID) Статик».
 * Файл без серверного кода: можно импортировать и в клиентских компонентах.
 */
export type Person = {
  /** Telegram ID */
  id: string;
  /** Имя из Telegram: показывается, пока администратор не указал Никнейм */
  name: string;
  nickname: string | null;
  staticId: string | null;
  /** Группа администратора. null: обычный участник или человек, которого больше нет в базе */
  group: AdminGroup | null;
};

/** Человек, о котором известно только имя (например, запись старше появления профилей). */
export const personFromName = (name: string, id = ""): Person => ({
  id,
  name,
  nickname: null,
  staticId: null,
  group: null,
});

/** Основное имя: Никнейм, а если его нет, имя из Telegram. */
export const personLabel = (person: Pick<Person, "name" | "nickname">): string => person.nickname ?? person.name;

/** Обычный текст без иконок для Telegram и поиска: «Garik_Brown (5443)». */
export const personPlainText = (person: Pick<Person, "name" | "nickname" | "staticId">): string =>
  person.staticId ? `${personLabel(person)} (${person.staticId})` : personLabel(person);
