"use client";

import { useState, useTransition } from "react";

import { Check, Copy, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/academy/format";
import { INVITE_LIMITS, type InviteStatus, type InviteSummary } from "@/lib/academy/types";

import { copyText } from "../../replies/_components/copy-text";
import { createInviteAction, listInvitesAction, revokeInviteAction } from "../_actions";

const STATUS: Record<InviteStatus, { label: string; className: string }> = {
  pending: { label: "Ждёт", className: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" },
  started: { label: "Использована", className: "text-muted-foreground" },
  expired: { label: "Истекла", className: "border-amber-500/40 text-amber-600 dark:text-amber-400" },
  revoked: { label: "Отозвана", className: "border-destructive/40 text-destructive" },
};

/** Одноразовые ссылки на закрытый тест: создать, скопировать (адрес виден один раз) и отозвать неиспользованную. */
export function TestInviteDialog({ testId, title }: { testId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [invites, setInvites] = useState<InviteSummary[] | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      try {
        const result = await listInvitesAction(testId);
        if (result.ok) setInvites(result.invites);
        else toast.error(result.error);
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      }
    });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setCreated(null);
      setCopied(false);
      setLabel("");
      load();
    }
  };

  const copy = async (url: string) => {
    const ok = await copyText(url);
    setCopied(ok);
    if (ok) toast.success("Ссылка скопирована");
    else toast.error("Не удалось скопировать, выделите ссылку вручную");
  };

  const create = () =>
    startTransition(async () => {
      try {
        const result = await createInviteAction(testId, label);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setCreated(result.url);
        setInvites(result.invites);
        setLabel("");
        await copy(result.url);
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      }
    });

  const revoke = (inviteId: string) =>
    startTransition(async () => {
      try {
        const result = await revokeInviteAction(testId, inviteId);
        if (result.ok) setInvites(result.invites);
        else toast.error(result.error);
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      }
    });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Одноразовые ссылки на тест «${title}»`}>
          <Link2 />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ссылки на закрытый тест</DialogTitle>
          <DialogDescription>
            «{title}». Каждая ссылка работает один раз и {INVITE_LIMITS.ttlDays} дней: пройти тест по ней можно без
            входа на сайт.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-label">Для кого ссылка (по желанию)</Label>
          <div className="flex gap-2">
            <Input
              id="invite-label"
              value={label}
              maxLength={INVITE_LIMITS.label}
              disabled={pending}
              placeholder="Например, кандидат в хелперы"
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !pending) create();
              }}
            />
            <Button onClick={create} disabled={pending} className="shrink-0">
              Создать ссылку
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">Пометка видна только вам, человек её не увидит.</p>
        </div>

        {created && (
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
            <span className="font-medium text-sm">Ссылка готова</span>
            <div className="flex gap-2">
              <Input
                readOnly
                value={created}
                onFocus={(event) => event.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" aria-label="Скопировать ссылку" onClick={() => copy(created)}>
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Адрес виден только сейчас: потом на сайте остаётся лишь отметка о ссылке. Потеряли — создайте новую.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="font-medium text-sm">Выданные ссылки</span>
          {invites === null && <p className="text-muted-foreground text-sm">Загрузка...</p>}
          {invites?.length === 0 && (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground text-sm">
              Ссылок пока нет.
            </p>
          )}
          {invites && invites.length > 0 && (
            <ul className="flex flex-col divide-y rounded-lg border">
              {invites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{invite.label || "Без пометки"}</span>
                    <span className="text-muted-foreground text-xs">
                      {invite.usedAt
                        ? `Начат ${formatDateTime(invite.usedAt)}`
                        : `Создана ${formatDateTime(invite.createdAt)}, до ${formatDateTime(invite.expiresAt)}`}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="outline" className={STATUS[invite.status].className}>
                      {STATUS[invite.status].label}
                    </Badge>
                    {invite.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Отозвать ссылку"
                        disabled={pending}
                        onClick={() => revoke(invite.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
