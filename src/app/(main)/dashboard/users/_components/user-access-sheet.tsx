"use client";

import { Fragment } from "react";

import { RotateCcw } from "lucide-react";

import { PersonAvatar } from "@/components/person-avatar";
import { PersonName } from "@/components/person-name";
import { groupIconComponent, RoleBadge } from "@/components/role-icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  type AdminGroup,
  groupInfo,
  type Permission,
  type PermissionDef,
  type PermissionOverride,
  permissionDefs,
} from "@/lib/auth/groups";
import { personLabel } from "@/lib/auth/person";
import { getInitials } from "@/lib/utils";

import { assignableGroups, canManage, type Me, type UserItem, userPerson } from "../_lib";

const categories = Array.from(new Set(permissionDefs.map((def) => def.category)));

type Props = {
  user: UserItem | null;
  onClose: () => void;
  me: Me;
  lockedAdminIds: string[];
  groupPermissions: Record<AdminGroup, Permission[]>;
  busy: ReadonlySet<string>;
  onGroup: (user: UserItem, group: AdminGroup | "none") => void;
  onToggle: (user: UserItem, permission: Permission, mode: PermissionOverride | null) => void;
  onReset: (user: UserItem) => void;
};

/** Боковая панель одного пользователя: группа и права. Всё применяется сразу, без перезагрузки страницы. */
export function UserAccessSheet({
  user,
  onClose,
  me,
  lockedAdminIds,
  groupPermissions,
  busy,
  onGroup,
  onToggle,
  onReset,
}: Props) {
  const manageable = user ? canManage(me, user, lockedAdminIds) : false;
  const userBusy = user ? busy.has(user.telegramId) : false;
  const overrideCount = user ? Object.keys(user.overrides).length : 0;
  const groupOptions: { id: AdminGroup | "none"; label: string }[] = [
    { id: "none", label: "Участник" },
    ...assignableGroups(me).map((group) => ({ id: group, label: groupInfo[group].label })),
  ];

  return (
    <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {user && (
          <>
            <SheetHeader className="border-b p-4 pr-12">
              <div className="flex items-center gap-3">
                {user.adminGroup ? (
                  <PersonAvatar id={user.telegramId} name={personLabel(user)} className="size-10 rounded-full text-sm" />
                ) : (
                  <Avatar className="size-10">
                    <AvatarFallback>{getInitials(personLabel(user))}</AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0 text-left">
                  <SheetTitle className="truncate">
                    <PersonName person={userPerson(user)} />
                  </SheetTitle>
                  <SheetDescription className="truncate">
                    {[user.nickname ? user.name : null, user.username ? `@${user.username}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </SheetDescription>
                </div>
                <RoleBadge group={user.adminGroup} className="ml-auto shrink-0" />
              </div>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
              {!manageable && (
                <p className="rounded-lg border border-dashed p-3 text-muted-foreground text-sm">
                  Менять группу и права этого пользователя вы не можете: для этого нужно право «Назначение групп», а
                  пользователь должен быть ниже вашей группы.
                </p>
              )}

              <section className="flex flex-col gap-2" aria-label="Группа">
                <h3 className="font-medium text-sm">Группа</h3>
                <div className="flex flex-wrap gap-2">
                  {groupOptions.map((option) => {
                    const current = (user.adminGroup ?? "none") === option.id;
                    return (
                      <Button
                        key={option.id}
                        size="sm"
                        variant={current ? "default" : "outline"}
                        aria-pressed={current}
                        disabled={!manageable || userBusy || (!current && busy.size > 0 && isTogglingUser(busy, user))}
                        onClick={() => !current && onGroup(user, option.id)}
                      >
                        {option.id !== "none" && <GroupOptionIcon group={option.id} />}
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
                {user.adminGroup && (
                  <p className="text-muted-foreground text-xs">{groupInfo[user.adminGroup].description}</p>
                )}
              </section>

              <section className="flex flex-col gap-3" aria-label="Права">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium text-sm">Права</h3>
                  {overrideCount > 0 && (
                    <Button size="xs" variant="ghost" disabled={!manageable || userBusy} onClick={() => onReset(user)}>
                      <RotateCcw data-icon="inline-start" /> Сбросить личные ({overrideCount})
                    </Button>
                  )}
                </div>

                {permissionsNotice(user.adminGroup) ? (
                  <p className="rounded-lg border border-dashed p-3 text-muted-foreground text-sm">
                    {permissionsNotice(user.adminGroup)}
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {categories.map((category) => (
                      <Fragment key={category}>
                        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{category}</p>
                        <ul className="flex flex-col divide-y rounded-xl border">
                          {permissionDefs
                            .filter((def) => def.category === category)
                            .map((def) => {
                              const group = user.adminGroup as AdminGroup;
                              const fromGroup = groupPermissions[group].includes(def.key);
                              const mode = user.overrides[def.key];
                              const granted = mode ? mode === "grant" : fromGroup;
                              // Выдать можно только то, что есть у самого администратора
                              const turnsOnAsGrant = !granted && !fromGroup;
                              const lacksPermission =
                                turnsOnAsGrant && me.level < 4 && !me.permissions.includes(def.key);
                              const toggling = busy.has(`${user.telegramId}:${def.key}`);
                              const disabled = !manageable || def.locked || userBusy || toggling || lacksPermission;

                              return (
                                <li key={def.key} className="flex items-start justify-between gap-3 p-3">
                                  <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2 font-medium text-sm">
                                      {def.label}
                                      {mode === "grant" && <Badge>Выдано лично</Badge>}
                                      {mode === "deny" && <Badge variant="destructive">Отозвано лично</Badge>}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                      {permissionHint(def, lacksPermission)}
                                    </p>
                                  </div>
                                  <Switch
                                    className="mt-0.5"
                                    checked={granted}
                                    disabled={disabled}
                                    aria-label={`${def.label}: ${user.name}`}
                                    onCheckedChange={(value) => {
                                      // Если выбор совпал с правами группы, личная настройка просто убирается
                                      onToggle(user, def.key, nextOverride(value, fromGroup));
                                    }}
                                  />
                                </li>
                              );
                            })}
                        </ul>
                      </Fragment>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <p className="border-t p-3 text-center text-muted-foreground text-xs">
              Изменения сохраняются сразу. Пользователь увидит их при следующем открытии страницы.
            </p>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Идёт ли сейчас сохранение личного права этого пользователя (ключи вида «id:право»). */
function isTogglingUser(busy: ReadonlySet<string>, user: UserItem) {
  for (const key of busy) if (key.startsWith(`${user.telegramId}:`)) return true;
  return false;
}

/** Что показать вместо списка прав, если настраивать нечего. */
function permissionsNotice(group: AdminGroup | null): string | null {
  if (group === null) {
    return "Права выдаются администраторам. Назначьте группу, и здесь можно будет настроить отдельные права.";
  }
  if (group === "chief") return "У Гл.Администратора всегда есть все права, их нельзя ограничить.";
  return null;
}

function permissionHint(def: PermissionDef, lacksPermission: boolean): string {
  if (def.locked) return "Только у Гл.Администратора";
  if (lacksPermission) return "Нельзя выдать: у вас самих нет этого права";
  return def.description;
}

/** Если выбор совпал с правами группы, личная настройка убирается, иначе право выдаётся или отзывается лично. */
function nextOverride(value: boolean, fromGroup: boolean): PermissionOverride | null {
  if (value === fromGroup) return null;
  return value ? "grant" : "deny";
}

function GroupOptionIcon({ group }: { group: AdminGroup }) {
  const Icon = groupIconComponent(group);
  return <Icon data-icon="inline-start" aria-hidden="true" />;
}
