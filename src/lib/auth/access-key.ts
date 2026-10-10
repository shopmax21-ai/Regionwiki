import type { Permission } from "./groups";

/**
 * Короткий «отпечаток» доступа: статус, роль, группа и права. Layout кладёт его на страницу,
 * а `/api/auth/access` отдаёт актуальный. Если они разошлись, страница перерисовывается без перезагрузки.
 */
export const accessKey = (input: {
  status: string;
  role: string;
  group: string | null;
  permissions: readonly Permission[] | readonly string[];
}): string => `${input.status}|${input.role}|${input.group ?? ""}|${[...input.permissions].sort().join(",")}`;
