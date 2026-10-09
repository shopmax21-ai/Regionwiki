import type { Person } from "@/lib/auth/person";

/**
 * Баг-репорты: сообщения об ошибках на сайте. Отправить может любой вошедший участник, читать и обрабатывать
 * только администраторы с правами «bugs.view» и «bugs.manage». Файл без серверного кода: его можно
 * импортировать и в клиентских компонентах.
 */

export const BUG_STATUSES = ["new", "in_progress", "done"] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
  new: "Новый",
  in_progress: "В работе",
  done: "Выполнено",
};

export const isBugStatus = (value: unknown): value is BugStatus =>
  typeof value === "string" && (BUG_STATUSES as readonly string[]).includes(value);

export const BUG_LIMITS = { title: 120, description: 2000 } as const;

export type BugReport = {
  id: string;
  title: string;
  description: string;
  /** Страница сайта, на которой нажали кнопку (путь без домена) */
  pagePath: string;
  createdAt: string;
  reporter: Person;
  status: BugStatus;
  /** Кто взял в работу (null, пока никто) */
  assignee: Person | null;
  takenAt: string | null;
  /** Кто и когда отметил выполненным */
  doneBy: Person | null;
  doneAt: string | null;
};

export type BugCounts = Record<BugStatus, number>;
