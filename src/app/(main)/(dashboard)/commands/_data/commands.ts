/**
 * Команды сервера. Чтобы добавить или поправить команду, достаточно изменить этот список:
 * раздел, поиск, сортировка и цвета подхватят изменения сами.
 *
 * level: номер уровня доступа к команде. На сайте он показывается как «1M», «2M» и т.д.
 * argument: аргументы команды, пустая строка, если их нет.
 */
export type ServerCommand = {
  level: number;
  command: string;
  argument: string;
  description: string;
};

export const levelLabel = (level: number) => `${level}M`;

export const serverCommands: readonly ServerCommand[] = [
  {
    level: 1,
    command: "/mute",
    argument: "[chat | voice] [ID] [минуты] [причина]",
    description: "Выдать мут в текстовом или голосовом чате.",
  },
  {
    level: 2,
    command: "/jail",
    argument: "[UID] [время] [пункты наказания]",
    description: "Посадить игрока в деморган на указанное время.",
  },
  {
    level: 3,
    command: "/ban",
    argument: "[ID] [дни] [причина]",
    description: "Заблокировать аккаунт игрока на указанное число дней.",
  },
  {
    level: 4,
    command: "/hardban",
    argument: "[ID] [дни] [причина]",
    description: "Заблокировать игрока вместе с привязками к устройству.",
  },
];
