import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Clock, Inbox, Users, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DbUser } from "@/lib/auth/db";

import { AccessAvatar } from "./access-avatar";
import { DecisionButtons } from "./decision-buttons";
import { type MemberRow, MembersList } from "./members-list";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

/** «5 мин назад», «3 ч назад», «вчера» и т.д. Считается на сервере, страница всегда свежая (force-dynamic). */
function ago(date: Date, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - date.getTime()) / 60_000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  return days === 1 ? "вчера" : `${days} дн. назад`;
}

type Tone = "amber" | "green" | "red" | "neutral";

const TONES: Record<Tone, { box: string; icon: string }> = {
  amber: { box: "from-amber-500/15 to-transparent", icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  green: { box: "from-green-500/15 to-transparent", icon: "bg-green-500/15 text-green-600 dark:text-green-400" },
  red: { box: "from-red-500/15 to-transparent", icon: "bg-red-500/15 text-red-600 dark:text-red-400" },
  neutral: { box: "from-primary/10 to-transparent", icon: "bg-primary/10 text-primary" },
};

function StatTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: Tone }) {
  return (
    <Card className={cn("relative overflow-hidden bg-gradient-to-br", TONES[tone].box)}>
      <CardContent className="flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONES[tone].icon)}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="font-semibold text-2xl tabular-nums">{value}</p>
          <p className="truncate text-muted-foreground text-xs">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingCard({ user, now }: { user: DbUser; now: number }) {
  return (
    <Card className="relative overflow-hidden ring-amber-500/30">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500"
      />
      <CardContent className="flex flex-col gap-4 pt-2">
        <div className="flex items-center gap-3">
          <AccessAvatar id={user.telegramId} name={user.name} admin={user.adminGroup !== null} className="size-12" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-muted-foreground text-sm">
              {user.username ? `@${user.username}` : "Без username"}
            </p>
          </div>
        </div>

        <p
          className="flex items-center gap-1.5 text-muted-foreground text-xs"
          title={dateFormat.format(user.createdAt)}
        >
          <Clock className="size-3.5" aria-hidden="true" />
          Подал(а) заявку {ago(user.createdAt, now)}
        </p>

        <DecisionButtons telegramId={user.telegramId} size="default" stretch />
      </CardContent>
    </Card>
  );
}

export function AccessList({ users }: { users: DbUser[] }) {
  const now = Date.now();
  const pending = users
    .filter((user) => user.status === "pending")
    // Давно ждущие заявки сверху
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const others = users.filter((user) => user.status !== "pending");

  const approved = others.filter((user) => user.status === "approved").length;
  const rejected = others.length - approved;

  const rows: MemberRow[] = others.map((user) => ({
    telegramId: user.telegramId,
    name: user.name,
    username: user.username,
    status: user.status === "approved" ? "approved" : "rejected",
    admin: user.role === "admin",
    lastLogin: user.lastLoginAt ? dateFormat.format(user.lastLoginAt) : "Не входил(а)",
    loginCount: user.loginCount,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">Заявки на доступ</h1>
        <p className="text-muted-foreground text-sm">
          Решайте, кто получит доступ к панели. Мы напишем в Telegram, когда придёт новая заявка.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Clock} label="Ждут решения" value={pending.length} tone="amber" />
        <StatTile icon={CheckCircle2} label="Одобрено" value={approved} tone="green" />
        <StatTile icon={XCircle} label="Отклонено" value={rejected} tone="red" />
        <StatTile icon={Users} label="Всего участников" value={users.length} tone="neutral" />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg">Новые заявки</h2>
          {pending.length > 0 && (
            <Badge className="gap-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-300" variant="secondary">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500/70" />
                <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
              </span>
              {pending.length}
            </Badge>
          )}
        </div>

        {pending.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pending.map((user) => (
              <PendingCard key={user.telegramId} user={user} now={now} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-gradient-to-b from-muted/40 to-transparent px-6 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-green-500/15 text-green-600 dark:text-green-400">
              <Inbox className="size-7" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-medium">Все заявки разобраны</p>
              <p className="max-w-sm text-muted-foreground text-sm">
                Когда кто-то попросит доступ, заявка появится здесь и придёт уведомлением в Telegram.
              </p>
            </div>
          </div>
        )}
      </section>

      <MembersList rows={rows} />
    </div>
  );
}
