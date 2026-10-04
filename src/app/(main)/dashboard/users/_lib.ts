import type { DbUser } from "@/lib/auth/db";
import { type AdminGroup, adminGroups, groupLevel, type Permission, type PermissionOverrides } from "@/lib/auth/groups";

/** Пользователь в виде, пригодном для передачи в браузер. */
export type UserItem = {
  telegramId: string;
  name: string;
  username: string | null;
  status: "pending" | "approved" | "rejected";
  adminGroup: AdminGroup | null;
  /** Личные права поверх группы */
  overrides: PermissionOverrides;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
};

export const toUserItem = (user: DbUser, overrides: PermissionOverrides = {}): UserItem => ({
  telegramId: user.telegramId,
  name: user.name,
  username: user.username,
  status: user.status,
  adminGroup: user.adminGroup,
  overrides: user.adminGroup ? overrides : {},
  createdAt: user.createdAt.toISOString(),
  lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  loginCount: user.loginCount,
});

/** Права текущего администратора, нужные интерфейсу, чтобы не показывать кнопки, которые всё равно откажут. */
export type Me = { id: string; level: number; canDecide: boolean; canAssign: boolean; permissions: Permission[] };

/** Можно ли менять группу и личные права этого пользователя. Сервер проверяет то же самое ещё раз. */
export const canManage = (me: Me, user: UserItem, lockedAdminIds: readonly string[]) =>
  me.canAssign &&
  user.telegramId !== me.id &&
  !lockedAdminIds.includes(user.telegramId) &&
  (me.level >= 4 || groupLevel(user.adminGroup) < me.level);

/** Группы, которые этот администратор вправе выдавать: Гл.Администратор любые, остальные только ниже своей. */
export const assignableGroups = (me: Me): AdminGroup[] =>
  adminGroups.filter((group) => me.level >= 4 || groupLevel(group) < me.level);
