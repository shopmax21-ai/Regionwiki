import { Check, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DbUser } from "@/lib/auth/db";
import { getInitials } from "@/lib/utils";

import { decideAccess } from "../_actions";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

const statusLabel = { pending: "Ожидает", approved: "Одобрен", rejected: "Отклонён" } as const;

function UserIdentity({ user }: { user: DbUser }) {
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

function DecisionButtons({ user, only }: { user: DbUser; only?: "approved" | "rejected" }) {
  return (
    <form action={decideAccess} className="flex shrink-0 gap-2">
      <input type="hidden" name="telegramId" value={user.telegramId} />
      {only !== "approved" && (
        <Button type="submit" name="decision" value="rejected" variant="outline" size="sm">
          <X /> Отклонить
        </Button>
      )}
      {only !== "rejected" && (
        <Button type="submit" name="decision" value="approved" size="sm">
          <Check /> Одобрить
        </Button>
      )}
    </form>
  );
}

export function AccessList({ users }: { users: DbUser[] }) {
  const pending = users.filter((user) => user.status === "pending");
  const others = users.filter((user) => user.status !== "pending");

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Заявки на доступ</CardTitle>
          <CardDescription>
            {pending.length > 0 ? `Ждут решения: ${pending.length}` : "Новых заявок нет. Мы напишем в Telegram, когда они появятся."}
          </CardDescription>
        </CardHeader>
        {pending.length > 0 && (
          <CardContent className="flex flex-col divide-y">
            {pending.map((user) => (
              <div key={user.telegramId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <UserIdentity user={user} />
                <div className="flex items-center gap-4">
                  <span className="hidden text-muted-foreground text-xs sm:inline">{dateFormat.format(user.createdAt)}</span>
                  <DecisionButtons user={user} />
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Все участники</CardTitle>
          <CardDescription>Статус, последний вход и количество входов.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {others.length === 0 && <p className="text-muted-foreground text-sm">Пока никого нет.</p>}
          {others.map((user) => (
            <div key={user.telegramId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <UserIdentity user={user} />
              <div className="flex items-center gap-4">
                <div className="hidden text-right text-muted-foreground text-xs sm:block">
                  <p>{user.lastLoginAt ? dateFormat.format(user.lastLoginAt) : "Не входил"}</p>
                  <p>Входов: {user.loginCount}</p>
                </div>
                {user.role === "admin" && <Badge variant="secondary">Админ</Badge>}
                <Badge variant={user.status === "approved" ? "default" : "destructive"}>{statusLabel[user.status]}</Badge>
                {user.role !== "admin" && (
                  <DecisionButtons user={user} only={user.status === "approved" ? "rejected" : "approved"} />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
