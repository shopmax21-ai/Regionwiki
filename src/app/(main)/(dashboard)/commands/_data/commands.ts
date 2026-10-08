/**
 * Команды сервера. Встроенные команды кладутся в базу при первом запуске, дальше администраторы с правом
 * «Редактирование команд сервера» добавляют и меняют их прямо на сайте. Если базы нет, показывается этот список.
 *
 * level: номер уровня доступа к команде. На сайте он показывается как «1M», «2M» и т.д.
 * argument: аргументы команды, пустая строка, если их нет.
 */
export type ServerCommand = {
  id: string;
  level: number;
  command: string;
  argument: string;
  description: string;
};

export const COMMAND_LIMITS = { command: 40, argument: 200, description: 300 } as const;

/** Наибольший уровень: для каждого есть свой цвет в таблице */
export const COMMAND_LEVEL_MAX = 6;

export const levelLabel = (level: number) => `${level}M`;

export const seedCommands: readonly ServerCommand[] = [
  {
    id: "mute",
    level: 1,
    command: "/mute",
    argument: "[chat | voice] [ID] [минуты] [причина]",
    description: "Выдать мут в текстовом или голосовом чате.",
  },
  {
    id: "jail",
    level: 2,
    command: "/jail",
    argument: "[UID] [время] [пункты наказания]",
    description: "Посадить игрока в деморган на указанное время.",
  },
  {
    id: "ban",
    level: 3,
    command: "/ban",
    argument: "[ID] [дни] [причина]",
    description: "Заблокировать аккаунт игрока на указанное число дней.",
  },
  {
    id: "hardban",
    level: 4,
    command: "/hardban",
    argument: "[ID] [дни] [причина]",
    description: "Заблокировать игрока вместе с привязками к устройству.",
  },
];
