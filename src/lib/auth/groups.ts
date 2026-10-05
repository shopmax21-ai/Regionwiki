/**
 * Группы администраторов и права. Файл без серверного кода: его можно импортировать и в клиентских компонентах.
 * Гл.Администратор всегда имеет все права. Права остальных групп настраиваются в разделе «Роли и права».
 */

export const adminGroups = ["helper", "junior", "admin", "chief"] as const;
export type AdminGroup = (typeof adminGroups)[number];

export const editableGroups = ["helper", "junior", "admin"] as const;
export type EditableGroup = (typeof editableGroups)[number];

export const isAdminGroup = (value: unknown): value is AdminGroup =>
  typeof value === "string" && (adminGroups as readonly string[]).includes(value);

export const isEditableGroup = (value: unknown): value is EditableGroup =>
  typeof value === "string" && (editableGroups as readonly string[]).includes(value);

export const groupInfo: Record<AdminGroup, { label: string; level: number; description: string }> = {
  helper: {
    label: "Хелпер",
    level: 1,
    description: "Помогает игрокам и следит за порядком. Минимальные права.",
  },
  junior: {
    label: "Мл.администратор",
    level: 2,
    description: "Принимает решения по заявкам и помогает администраторам.",
  },
  admin: {
    label: "Администратор",
    level: 3,
    description: "Управляет контентом и набирает младший состав.",
  },
  chief: {
    label: "Гл.Администратор",
    level: 4,
    description: "Полный доступ ко всем разделам. Только он меняет права групп.",
  },
};

/** Чем выше уровень, тем старше группа. 0 — обычный участник. */
export const groupLevel = (group: AdminGroup | null | undefined) => (group ? groupInfo[group].level : 0);

export type Permission =
  | "users.view"
  | "access.decide"
  | "groups.assign"
  | "transport.edit"
  | "items.edit"
  | "replies.view"
  | "replies.edit"
  | "jobs.edit"
  | "academy.edit"
  | "academy.results"
  | "permissions.view"
  | "permissions.edit";

export type PermissionDef = {
  key: Permission;
  label: string;
  description: string;
  category: string;
  /** Зафиксировано за Гл.Администратором, переключить нельзя */
  locked?: boolean;
};

export const permissionDefs: readonly PermissionDef[] = [
  {
    key: "users.view",
    label: "Просмотр пользователей",
    description: "Открывает раздел «Пользователи» со списком и статусами.",
    category: "Пользователи",
  },
  {
    key: "access.decide",
    label: "Одобрение доступа",
    description: "Одобрять и отклонять заявки и доступ участников.",
    category: "Пользователи",
  },
  {
    key: "groups.assign",
    label: "Назначение групп",
    description: "Выдавать и снимать группы и отдельные права пользователям, но только ниже своей группы.",
    category: "Пользователи",
  },
  {
    key: "transport.edit",
    label: "Редактирование транспорта",
    description: "Добавлять транспорт и менять его характеристики.",
    category: "Контент",
  },
  {
    key: "items.edit",
    label: "Редактирование предметов",
    description: "Добавлять, изменять и удалять предметы в разделе «Предметы», загружать их картинки.",
    category: "Контент",
  },
  {
    key: "replies.view",
    label: "Быстрые ответы на репорты",
    description: "Открывает раздел «Быстрые ответы» и позволяет копировать готовые ответы.",
    category: "Контент",
  },
  {
    key: "replies.edit",
    label: "Редактирование быстрых ответов",
    description: "Добавлять, изменять и удалять быстрые ответы на репорты.",
    category: "Контент",
  },
  {
    key: "jobs.edit",
    label: "Редактирование работ и гайдов",
    description: "Добавлять, изменять и удалять работы и их гайды в разделе «Всё о работах».",
    category: "Контент",
  },
  {
    key: "academy.edit",
    label: "Редактирование тестов",
    description: "Создавать, изменять и удалять тесты в разделе «Академия».",
    category: "Академия",
  },
  {
    key: "academy.results",
    label: "Результаты и разбор тестов",
    description:
      "Раздел «Результаты тестов»: правильность ответов и подробный разбор по каждому пройденному тесту. Только Гл.Администратор.",
    category: "Академия",
    locked: true,
  },
  {
    key: "permissions.view",
    label: "Просмотр прав",
    description: "Открывает раздел «Роли и права» только для чтения.",
    category: "Права",
  },
  {
    key: "permissions.edit",
    label: "Изменение прав групп",
    description: "Включать и выключать права у групп. Только Гл.Администратор.",
    category: "Права",
    locked: true,
  },
];

export const allPermissions: readonly Permission[] = permissionDefs.map((def) => def.key);
export const toggleablePermissions: readonly Permission[] = permissionDefs
  .filter((def) => !def.locked)
  .map((def) => def.key);

export const isPermission = (value: unknown): value is Permission =>
  typeof value === "string" && (allPermissions as readonly string[]).includes(value);

export const isToggleablePermission = (value: unknown): value is Permission =>
  typeof value === "string" && (toggleablePermissions as readonly string[]).includes(value);

/** Права по умолчанию. Применяются, пока Гл.Администратор ничего не менял. */
export const defaultPermissions: Record<EditableGroup, readonly Permission[]> = {
  helper: ["users.view", "replies.view", "permissions.view"],
  junior: ["users.view", "access.decide", "replies.view", "permissions.view"],
  admin: [
    "users.view",
    "access.decide",
    "groups.assign",
    "transport.edit",
    "items.edit",
    "replies.view",
    "replies.edit",
    "jobs.edit",
    "academy.edit",
    "permissions.view",
  ],
};

/**
 * Личная настройка права поверх группы: "grant" выдаёт право, которого у группы нет, "deny" забирает то, что есть.
 * Отсутствие записи означает «как у группы».
 */
export type PermissionOverride = "grant" | "deny";
export type PermissionOverrides = Partial<Record<Permission, PermissionOverride>>;

export const isPermissionOverride = (value: unknown): value is PermissionOverride =>
  value === "grant" || value === "deny";

/** Итоговые права человека: права группы плюс выданные лично, минус отозванные лично. */
export function effectivePermissions(
  base: readonly Permission[],
  overrides: PermissionOverrides | undefined,
): Permission[] {
  if (!overrides) return [...base];
  const result = new Set<Permission>(base);
  for (const [key, mode] of Object.entries(overrides) as [Permission, PermissionOverride][]) {
    if (mode === "grant") result.add(key);
    else result.delete(key);
  }
  return allPermissions.filter((key) => result.has(key));
}
