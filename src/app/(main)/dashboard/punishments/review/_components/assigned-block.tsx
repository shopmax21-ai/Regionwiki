"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Check, CheckCheck, Copy, ExternalLink, Save, Undo2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildCommand,
  isCommandAvailable,
  kindText,
  needsDecision,
  PUNISHMENT_LIMITS,
  type PunishmentRequest,
} from "@/lib/punishments/types";

import { copyText } from "../../../replies/_components/copy-text";
import {
  approveRequestAction,
  issuePunishmentAction,
  markCopiedAction,
  rejectRequestAction,
  releaseRequestAction,
  setForumAction,
} from "../../_actions";
import { ago, durationLabel } from "../../_components/format";
import { AdminStatusBadge, RuleChips } from "../../_components/status-badge";

type Step = "approve" | "reject" | "copy" | "issue" | "release" | "forum" | null;

/**
 * Блок заявки у администратора, который её взял. Есть доказательства: «Одобрить / Отклонить», после одобрения команда.
 * Доказательств нет: команда сразу. После копирования команды появляется кнопка «Выдал наказание», по ней наказание
 * фиксируется за администратором, а у хелпера статус становится «Выдано».
 * Жалобу на форуме (её мог указать хелпер) администратор может указать или поправить: она дописывается в конец команды,
 * а после изменения команду нужно скопировать заново.
 */
export function AssignedBlock({ request, now }: { request: PunishmentRequest; now: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Step>(null);
  const [copiedLocal, setCopiedLocal] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [note, setNote] = useState("");
  const [forumDraft, setForumDraft] = useState(request.forum);
  const [, startTransition] = useTransition();

  const command = buildCommand(request);
  const showCommand = isCommandAvailable(request);
  const decision = needsDecision(request);
  const copied = copiedLocal || request.copiedAt !== null;
  // Команда строится из сохранённой жалобы: пока правка не сохранена, копировать нельзя, иначе она не попадёт в команду
  const forumDirty = forumDraft.trim().replace(/\s+/g, " ") !== request.forum;

  const saveForum = () => {
    setBusy("forum");
    startTransition(async () => {
      try {
        const result = await setForumAction(request.id, forumDraft);
        if (!result.ok) {
          toast.error(result.error);
          router.refresh();
          return;
        }
        // Команда изменилась, на сервере «скопировано» сброшено
        setCopiedLocal(false);
        toast.success("Жалоба сохранена, команда обновлена");
        router.refresh();
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      } finally {
        setBusy(null);
      }
    });
  };

  const run = (
    step: Exclude<Step, null>,
    task: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success?: string,
  ) => {
    setBusy(step);
    startTransition(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          toast.error(result.error);
          // Состояние могло измениться (например, Гл.Администратор вернул заявку в очередь)
          router.refresh();
          return;
        }
        if (success) toast.success(success);
        router.refresh();
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      } finally {
        setBusy(null);
      }
    });
  };

  const copy = () => {
    setBusy("copy");
    startTransition(async () => {
      const copiedOk = await copyText(command);
      // Если буфер обмена недоступен, команду можно выделить вручную: кнопку «Выдал наказание» всё равно открываем
      if (copiedOk) toast.success("Команда скопирована");
      else toast.warning("Не удалось скопировать автоматически. Выделите команду и скопируйте вручную.");
      const result = await markCopiedAction(request.id).catch(() => ({
        ok: false as const,
        error: "Нет связи с сервером",
      }));
      if (result.ok) setCopiedLocal(true);
      else toast.error(result.error);
      setBusy(null);
    });
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            Заявка №{request.number}
            <AdminStatusBadge status={request.status} />
          </CardTitle>
          <span className="text-muted-foreground text-xs">
            {request.requesterName} · подана {ago(request.createdAt, now)}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Статик</dt>
            <dd className="font-medium tabular-nums">{request.staticId}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Наказание</dt>
            <dd className="font-medium">{kindText(request)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Срок</dt>
            <dd className="font-medium">{durationLabel(request)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">Пункты правил</dt>
            <dd>
              <RuleChips rules={request.rules} />
            </dd>
          </div>
        </dl>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {request.evidence.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-medium text-sm">Доказательства</p>
            <ul className="flex flex-wrap gap-2">
              {request.evidence.map((item) => (
                <li key={item.url}>
                  {item.type === "image" ? (
                    <a href={item.url} target="_blank" rel="noreferrer" aria-label="Открыть скриншот">
                      {/* biome-ignore lint/performance/noImgElement: превью загруженного скриншота */}
                      <img src={item.url} alt="Скриншот" className="h-20 w-32 rounded-lg border object-cover" />
                    </a>
                  ) : (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex max-w-72 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted"
                    >
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.url.replace(/^https:\/\//, "")}</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`forum-${request.id}`}>Жалоба на форуме</Label>
          <div className="flex items-center gap-2">
            <Input
              id={`forum-${request.id}`}
              value={forumDraft}
              maxLength={PUNISHMENT_LIMITS.forumMax}
              disabled={busy !== null}
              placeholder="Garik-0018"
              autoComplete="off"
              onChange={(event) => setForumDraft(event.target.value.replace(/[\r\n]/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && forumDirty && busy === null) saveForum();
              }}
            />
            <Button type="button" variant="outline" onClick={saveForum} disabled={busy !== null || !forumDirty}>
              <Save data-icon="inline-start" />
              {busy === "forum" ? "Сохраняем..." : "Сохранить"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Добавляется в конец команды. {request.forum ? "" : "Хелпер её не указал: впишите, если нужно."}
          </p>
        </div>

        {decision && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => run("approve", () => approveRequestAction(request.id), "Заявка одобрена")}
              disabled={busy !== null}
            >
              <Check data-icon="inline-start" />
              {busy === "approve" ? "Одобряем..." : "Одобрить"}
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setRejectOpen(true)}
              disabled={busy !== null}
            >
              Отклонить
            </Button>
            <span className="text-muted-foreground text-xs">Команда появится после одобрения.</span>
          </div>
        )}

        {showCommand && (
          <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-3">
            <p className="font-medium text-sm">Команда для выдачи наказания</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 select-all break-all rounded-lg bg-background px-3 py-2 font-mono text-sm">
                {command}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Скопировать команду"
                onClick={copy}
                disabled={busy !== null || forumDirty}
              >
                {copied ? <Check className="text-green-600" /> : <Copy />}
              </Button>
            </div>
            {forumDirty && (
              <p className="text-muted-foreground text-xs">Сохраните жалобу на форуме, чтобы она попала в команду.</p>
            )}
            {!forumDirty && copied && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() =>
                    run("issue", () => issuePunishmentAction(request.id), "Наказание зафиксировано за вами")
                  }
                  disabled={busy !== null}
                >
                  <CheckCheck data-icon="inline-start" />
                  {busy === "issue" ? "Фиксируем..." : "Выдал наказание"}
                </Button>
                <span className="text-muted-foreground text-xs">
                  Нажмите, когда выдадите наказание в игре. Оно закрепится за вами, а у хелпера появится статус
                  «Выдано».
                </span>
              </div>
            )}
            {!forumDirty && !copied && (
              <p className="text-muted-foreground text-xs">
                Скопируйте команду, выдайте наказание в игре, затем подтвердите выдачу.
              </p>
            )}
          </div>
        )}

        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setReleaseOpen(true)}
            disabled={busy !== null}
          >
            <Undo2 data-icon="inline-start" />
            Вернуть в очередь
          </Button>
        </div>
      </CardContent>

      <Dialog open={rejectOpen} onOpenChange={(open) => busy === null && setRejectOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отклонить заявку №{request.number}?</DialogTitle>
            <DialogDescription>Хелпер увидит статус «Отклонено» и вашу причину.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            maxLength={PUNISHMENT_LIMITS.noteMax}
            placeholder="Причина (необязательно): например, на видео нет нарушения"
            onChange={(event) => setNote(event.target.value)}
            className="min-h-24"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={busy !== null}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => {
                setRejectOpen(false);
                run("reject", () => rejectRequestAction(request.id, note), "Заявка отклонена");
              }}
            >
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вернуть заявку в очередь?</AlertDialogTitle>
            <AlertDialogDescription>
              Блок пропадёт у вас, заявку снова увидят и смогут взять другие администраторы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => run("release", () => releaseRequestAction(request.id), "Заявка возвращена в очередь")}
            >
              Вернуть
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
