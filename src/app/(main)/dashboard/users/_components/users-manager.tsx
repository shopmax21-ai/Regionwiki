"use client";

import { useMemo, useState } from "react";

import { Check, KeyRound, MoreHorizontal, Search, ShieldOff, X } from "lucide-react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/person-avatar";
import { PersonName } from "@/components/person-name";
import { groupIconComponent, RoleBadge } from "@/components/role-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  type AdminGroup,
  adminGroups,
  groupInfo,
  groupLevel,
  type Permission,
  type PermissionOverride,
} from "@/lib/auth/groups";
import { personLabel } from "@/lib/auth/person";
import { getInitials } from "@/lib/utils";

import {
  type ActionResult,
  changeUserGroup,
  changeUserPermission,
  changeUserStatus,
  resetUserPermissions,
} from "../_actions";
import { type Me, type UserItem, userPerson } from "../_lib";
import { UserAccessSheet } from "./user-access-sheet";

type Filter = "all" | "pending" | "approved" | "rejected" | "admin";
type Action = { type: "approve" } | { type: "reject" } | { type: "group"; group: AdminGroup | "none" };

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "pending", label: "Ожидают" },
  { id: "approved", label: "Одобрены" },
  { id: "rejected", label: "Отклонены" },
  { id: "admin", label: "Администраторы" },
];

const statusLabel = { pending: "Ожидает", approved: "Одобрен", rejected: "Отклонён" } as const;
const statusVariant = { pending: "secondary", approved: "default", rejected: "destructive" } as const;

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

const matchesFilter = (user: UserItem, filter: Filter) =>
  filter === "all" ? true : filter === "admin" ? user.adminGroup !== null : user.status === filter;

function confirmTexts(action: Action, name: string): { title: string; text: string; button: string } {
  switch (action.type) {
    case "approve":
      return {
        title: `Одобрить доступ: ${name}?`,
        text: "Пользователь получит доступ к закрытым разделам, а в Telegram придёт уведомление.",
        button: "Одобрить",
      };
    case "reject":
      return {
        title: `Отклонить доступ: ${name}?`,
        text: "Пользователь потеряет доступ к закрытым разделам (сессия обновится в течение нескольких минут), а в Telegram придёт уведомление.",
        button: "Отклонить",
      };
    case "group":
      return action.group === "none"
        ? {
            title: `Снять группу администратора: ${name}?`,
            text: "Пользователь останется участником с одобренным доступом, но потеряет все административные права.",
            button: "Снять группу",
          }
        : {
            title: `Назначить группу «${groupInfo[action.group].label}»: ${name}?`,
            text: `${groupInfo[action.group].description} Доступ пользователю будет одобрен автоматически.`,
            button: "Назначить",
          };
  }
}

function UserIdentity({ user }: { user: UserItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {user.adminGroup ? (
        <PersonAvatar id={user.telegramId} name={personLabel(user)} className="size-9 rounded-full text-xs" />
      ) : (
        <Avatar className="size-9">
          <AvatarFallback>{getInitials(personLabel(user))}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm">
          {/* Роль в этой строке уже показана бейджем в колонке «Группа»: иконку слева не дублируем в таблице */}
          <PersonName person={userPerson(user)} showRole={false} />
        </p>
        <p className="truncate text-muted-foreground text-xs">
          {[user.nickname ? user.name : null, user.username ? `@${user.username}` : null].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

const NO_CONNECTION: ActionResult = { ok: false, error: "Нет связи с сервером, попробуйте ещё раз" };

type UsersManagerProps = {
  users: UserItem[];
  me: Me;
  lockedAdminIds: string[];
  /** Права каждой группы: личные настройки считаются поверх них */
  groupPermissions: Record<AdminGroup, Permission[]>;
};

export function UsersManager({ users, me, lockedAdminIds, groupPermissions }: UsersManagerProps) {
  // Список живёт в состоянии: изменения показываются сразу, а ответ сервера лишь подтверждает или откатывает их.
  const [items, setItems] = useState(users);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingAction, setPendingAction] = useState<{ user: UserItem; action: Action } | null>(null);
  const [sheetUserId, setSheetUserId] = useState<string | null>(null);

  const sheetUser = items.find((user) => user.telegramId === sheetUserId) ?? null;

  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map(({ id }) => [id, items.filter((user) => matchesFilter(user, id)).length]),
      ) as Record<Filter, number>,
    [items],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/^@/, "");
    return items.filter(
      (user) =>
        matchesFilter(user, filter) &&
        `${user.name} ${user.nickname ?? ""} ${user.staticId ?? ""} ${user.username ?? ""}`
          .toLowerCase()
          .includes(needle),
    );
  }, [filter, query, items]);

  const patchUser = (id: string, update: (user: UserItem) => UserItem) =>
    setItems((prev) => prev.map((user) => (user.telegramId === id ? update(user) : user)));

  const setBusyKey = (key: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  /** Есть ли у пользователя незавершённые изменения: пока они идут, новые не запускаем, чтобы ответы не перемешались. */
  const isLocked = (id: string) => {
    for (const key of busy) if (key === id || key.startsWith(`${id}:`)) return true;
    return false;
  };

  /** Статус и группа: меняем в списке сразу, при отказе сервера возвращаем как было. */
  const apply = async (user: UserItem, action: Action) => {
    const id = user.telegramId;
    if (isLocked(id)) return;

    const snapshot = user;
    patchUser(id, (current) => {
      if (action.type === "group") {
        const group = action.group === "none" ? null : action.group;
        return {
          ...current,
          adminGroup: group,
          status: group ? "approved" : current.status,
          overrides: group ? current.overrides : {},
        };
      }
      return { ...current, status: action.type === "approve" ? "approved" : "rejected" };
    });
    setBusyKey(id, true);

    const result = await (action.type === "group"
      ? changeUserGroup(id, action.group)
      : changeUserStatus(id, action.type === "approve" ? "approved" : "rejected")
    ).catch(() => NO_CONNECTION);

    setBusyKey(id, false);
    if (result.ok) {
      patchUser(id, () => result.user);
      toast.success("Готово");
    } else {
      patchUser(id, () => snapshot);
      toast.error(result.error);
    }
  };

  /** Одно личное право: переключатель меняется сразу, откат касается только этого права. */
  const togglePermission = async (user: UserItem, permission: Permission, mode: PermissionOverride | null) => {
    const id = user.telegramId;
    const key = `${id}:${permission}`;
    if (busy.has(id) || busy.has(key)) return;

    const previous = user.overrides[permission] ?? null;
    const setMode = (value: PermissionOverride | null) =>
      patchUser(id, (current) => {
        const overrides = { ...current.overrides };
        if (value) overrides[permission] = value;
        else delete overrides[permission];
        return { ...current, overrides };
      });

    setMode(mode);
    setBusyKey(key, true);
    const result = await changeUserPermission(id, permission, mode).catch(() => NO_CONNECTION);
    setBusyKey(key, false);

    if (!result.ok) {
      setMode(previous);
      toast.error(result.error);
    }
  };

  const resetPermissions = async (user: UserItem) => {
    const id = user.telegramId;
    if (isLocked(id)) return;

    const snapshot = user.overrides;
    patchUser(id, (current) => ({ ...current, overrides: {} }));
    setBusyKey(id, true);
    const result = await resetUserPermissions(id).catch(() => NO_CONNECTION);
    setBusyKey(id, false);

    if (result.ok) {
      toast.success("Права сброшены до прав группы");
    } else {
      patchUser(id, (current) => ({ ...current, overrides: snapshot }));
      toast.error(result.error);
    }
  };

  const run = () => {
    if (!pendingAction) return;
    const { user, action } = pendingAction;
    // Окно закрываем сразу: результат уже виден в списке
    setPendingAction(null);
    void apply(user, action);
  };

  const actionsFor = (user: UserItem): { action: Action; label: string; icon: typeof Check }[] => {
    if (user.telegramId === me.id || lockedAdminIds.includes(user.telegramId)) return [];
    const list: { action: Action; label: string; icon: typeof Check }[] = [];
    const targetLevel = groupLevel(user.adminGroup);

    if (me.canDecide && user.adminGroup === null) {
      if (user.status !== "approved") list.push({ action: { type: "approve" }, label: "Одобрить доступ", icon: Check });
      if (user.status !== "rejected") list.push({ action: { type: "reject" }, label: "Отклонить доступ", icon: X });
    }

    // Гл.Администратор меняет любые группы, остальные только ниже своей
    if (me.canAssign && (me.level >= 4 || targetLevel < me.level)) {
      for (const group of adminGroups) {
        if (group === user.adminGroup || (me.level < 4 && groupLevel(group) >= me.level)) continue;
        list.push({
          action: { type: "group", group },
          label: `Назначить: ${groupInfo[group].label}`,
          icon: groupIconComponent(group),
        });
      }
      if (user.adminGroup)
        list.push({ action: { type: "group", group: "none" }, label: "Снять группу администратора", icon: ShieldOff });
    }
    return list;
  };

  const texts = pendingAction ? confirmTexts(pendingAction.action, pendingAction.user.name) : null;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
          <CardDescription>
            Все, кто входил через Telegram: статус доступа, роль и активность. Решения по заявкам тоже можно принимать
            здесь.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative min-w-0">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по имени, нику или @username"
              aria-label="Поиск пользователя"
              className="h-10 pl-9"
            />
          </div>

          <fieldset className="m-0 flex min-w-0 gap-2 overflow-x-auto border-0 p-0 pb-1">
            <legend className="sr-only">Фильтр пользователей</legend>
            {filters.map(({ id, label }) => (
              <Button
                key={id}
                size="sm"
                variant={filter === id ? "default" : "outline"}
                aria-pressed={filter === id}
                className="shrink-0"
                onClick={() => setFilter(id)}
              >
                {label} · {counts[id]}
              </Button>
            ))}
          </fieldset>
        </CardContent>
      </Card>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Пользователь</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Группа</TableHead>
              <TableHead className="hidden md:table-cell">Регистрация</TableHead>
              <TableHead className="hidden sm:table-cell">Последний вход</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Входов</TableHead>
              <TableHead className="w-12 pr-4 text-right">
                <span className="sr-only">Действия</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {items.length === 0 ? "Пока никто не входил." : "Никого не найдено. Измените запрос или фильтр."}
                </TableCell>
              </TableRow>
            )}
            {visible.map((user) => {
              const actions = actionsFor(user);
              return (
                <TableRow
                  key={user.telegramId}
                  aria-busy={isLocked(user.telegramId)}
                  className={isLocked(user.telegramId) ? "opacity-70" : undefined}
                >
                  <TableCell className="pl-4">
                    <UserIdentity user={user} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[user.status]}>{statusLabel[user.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <RoleBadge group={user.adminGroup} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground text-sm md:table-cell">
                    {/* Дата форматируется в часовом поясе б��аузера, поэтому сервер и клиент могут отличаться */}
                    <time dateTime={user.createdAt} suppressHydrationWarning>
                      {dateFormat.format(new Date(user.createdAt))}
                    </time>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground text-sm sm:table-cell">
                    {user.lastLoginAt ? (
                      <time dateTime={user.lastLoginAt} suppressHydrationWarning>
                        {dateFormat.format(new Date(user.lastLoginAt))}
                      </time>
                    ) : (
                      "Не входил"
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground text-sm lg:table-cell">
                    {user.loginCount}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {user.telegramId === me.id ? (
                      <span className="text-muted-foreground text-xs">Это вы</span>
                    ) : actions.length > 0 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Действия: ${user.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setSheetUserId(user.telegramId)}>
                            <KeyRound /> Права и роль
                          </DropdownMenuItem>
                          {actions.map(({ action, label, icon: Icon }) => (
                            <DropdownMenuItem key={label} onSelect={() => setPendingAction({ user, action })}>
                              <Icon /> {label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-muted-foreground text-xs" title="Администратор из настроек сервера">
                        Из настроек
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{texts?.title}</AlertDialogTitle>
            <AlertDialogDescription>{texts?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={run}>{texts?.button}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserAccessSheet
        user={sheetUser}
        onClose={() => setSheetUserId(null)}
        me={me}
        lockedAdminIds={lockedAdminIds}
        groupPermissions={groupPermissions}
        busy={busy}
        onGroup={(user, group) => void apply(user, { type: "group", group })}
        onToggle={(user, permission, mode) => void togglePermission(user, permission, mode)}
        onReset={(user) => void resetPermissions(user)}
      />
    </div>
  );
}
