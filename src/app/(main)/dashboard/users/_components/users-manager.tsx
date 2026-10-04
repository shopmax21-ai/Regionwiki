"use client";

import { useMemo, useState, useTransition } from "react";

import { Check, MoreHorizontal, Search, ShieldCheck, ShieldOff, X } from "lucide-react";
import { toast } from "sonner";

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
import { type AdminGroup, adminGroups, groupInfo, groupLevel } from "@/lib/auth/groups";
import { getInitials } from "@/lib/utils";

import { changeUserGroup, changeUserStatus } from "../_actions";

export type UserItem = {
  telegramId: string;
  name: string;
  username: string | null;
  status: "pending" | "approved" | "rejected";
  adminGroup: AdminGroup | null;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
};

type Filter = "all" | "pending" | "approved" | "rejected" | "admin";
type Action = { type: "approve" } | { type: "reject" } | { type: "group"; group: AdminGroup | "none" };

type Me = { id: string; level: number; canDecide: boolean; canAssign: boolean };

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
      <Avatar className="size-9">
        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 leading-tight">
        <p className="truncate font-medium text-sm">{user.name}</p>
        <p className="truncate text-muted-foreground text-xs">
          {user.username ? `@${user.username} · ` : ""}ID {user.telegramId}
        </p>
      </div>
    </div>
  );
}

export function UsersManager({ users, me, lockedAdminIds }: { users: UserItem[]; me: Me; lockedAdminIds: string[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingAction, setPendingAction] = useState<{ user: UserItem; action: Action } | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map(({ id }) => [id, users.filter((user) => matchesFilter(user, id)).length]),
      ) as Record<Filter, number>,
    [users],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/^@/, "");
    return users.filter(
      (user) =>
        matchesFilter(user, filter) &&
        `${user.name} ${user.username ?? ""} ${user.telegramId}`.toLowerCase().includes(needle),
    );
  }, [filter, query, users]);

  const run = () => {
    if (!pendingAction) return;
    const { user, action } = pendingAction;

    startTransition(async () => {
      const result =
        action.type === "group"
          ? await changeUserGroup(user.telegramId, action.group)
          : await changeUserStatus(user.telegramId, action.type === "approve" ? "approved" : "rejected");

      if (result.ok) toast.success("Готово");
      else toast.error(result.error);
      setPendingAction(null);
    });
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
          icon: ShieldCheck,
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
              placeholder="Поиск по имени, @username или Telegram ID"
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
                  {users.length === 0 ? "Пока никто не входил." : "Никого не найдено. Измените запрос или фильтр."}
                </TableCell>
              </TableRow>
            )}
            {visible.map((user) => {
              const actions = actionsFor(user);
              return (
                <TableRow key={user.telegramId}>
                  <TableCell className="pl-4">
                    <UserIdentity user={user} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[user.status]}>{statusLabel[user.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.adminGroup ? (
                      <Badge variant="secondary">{groupInfo[user.adminGroup].label}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Участник</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground text-sm md:table-cell">
                    {/* Дата форматируется в часовом поясе браузера, поэтому сервер и клиент могут отличаться */}
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

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && !isPending && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{texts?.title}</AlertDialogTitle>
            <AlertDialogDescription>{texts?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                run();
              }}
            >
              {isPending ? "Выполняем..." : texts?.button}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
