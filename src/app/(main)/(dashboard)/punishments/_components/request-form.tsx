"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type EvidenceItem,
  isDaysKind,
  KIND_LABELS,
  PUNISHMENT_LIMITS as L,
  MUTE_CHANNEL_LABELS,
  MUTE_CHANNELS,
  type MuteChannel,
  PUNISHMENT_KINDS,
  type PunishmentKind,
} from "@/lib/punishments/types";

import { createRequestAction } from "../_actions";
import { EvidenceField } from "./evidence-field";
import { RulePicker } from "./rule-picker";

const QUICK_MINUTES = [15, 30, 60, 120, 180, 300];
const QUICK_DAYS = [1, 3, 7, 14, 30, 60];

const PILL =
  "rounded-full border px-2.5 py-0.5 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-primary/10";

type Errors = Partial<Record<"staticId" | "duration" | "rules" | "forum", string>>;

/**
 * Форма заявки на наказание для хелпера: вид наказания (деморган, мут, бан, хардбан), статик, срок (минуты или дни),
 * пункты правил, жалоба на форуме и доказательства (необязательно).
 */
export function RequestForm() {
  const router = useRouter();
  const [staticId, setStaticId] = useState("");
  const [kind, setKind] = useState<PunishmentKind>("jail");
  const [muteChannel, setMuteChannel] = useState<MuteChannel>("chat");
  const [duration, setDuration] = useState("");
  const [forum, setForum] = useState("");
  const [rules, setRules] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const clear = (key: keyof Errors) => setErrors((current) => ({ ...current, [key]: undefined }));

  const days = isDaysKind(kind);
  const unit = days ? "дней" : "минут";
  const min = days ? L.minDays : L.minMinutes;
  const max = days ? L.maxDays : L.maxMinutes;

  const changeKind = (value: PunishmentKind) => {
    // Минуты и дни несравнимы: при смене единицы срок вводится заново
    if (isDaysKind(value) !== days) setDuration("");
    clear("duration");
    setKind(value);
  };

  const submit = () => {
    const next: Errors = {};
    if (staticId === "") next.staticId = "Введите статик игрока";
    const time = Number(duration);
    if (duration === "") next.duration = "Укажите срок наказания";
    else if (time < min || time > max) next.duration = `От ${min} до ${max} ${days ? "дн." : "мин"}`;
    if (forum.trim().length > L.forumMax) next.forum = `Не длиннее ${L.forumMax} символов`;
    if (rules.length === 0) next.rules = "Выберите хотя бы один пункт правил";
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      try {
        const result = await createRequestAction({
          staticId,
          kind,
          muteChannel: kind === "mute" ? muteChannel : null,
          duration: time,
          forum,
          rules,
          evidence,
        });
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        toast.success("Заявка отправлена. Администраторы получили уведомление.");
        setStaticId("");
        setDuration("");
        setForum("");
        setRules([]);
        setEvidence([]);
        router.refresh();
      } catch {
        setServerError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новая заявка</CardTitle>
        <CardDescription>
          После отправки все администраторы выше хелпера получат уведомление в Telegram. Статус заявки виден в таблице.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label>Наказание</Label>
          <div className="flex flex-wrap gap-1.5">
            {PUNISHMENT_KINDS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                disabled={pending}
                onClick={() => changeKind(value)}
                className={PILL}
              >
                {KIND_LABELS[value]}
              </button>
            ))}
          </div>
          {kind === "mute" && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Тип мута:</span>
              {MUTE_CHANNELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={muteChannel === value}
                  disabled={pending}
                  onClick={() => setMuteChannel(value)}
                  className={PILL}
                >
                  {MUTE_CHANNEL_LABELS[value]} ({value})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pun-static">Статик игрока</Label>
          <Input
            id="pun-static"
            inputMode="numeric"
            value={staticId}
            disabled={pending}
            aria-invalid={Boolean(errors.staticId)}
            placeholder="5476"
            onChange={(event) => {
              clear("staticId");
              setStaticId(event.target.value.replace(/\D/g, "").slice(0, L.staticMaxDigits));
            }}
          />
          {errors.staticId && (
            <p role="alert" className="text-destructive text-xs">
              {errors.staticId}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pun-duration">Срок наказания, {unit}</Label>
          <Input
            id="pun-duration"
            inputMode="numeric"
            value={duration}
            disabled={pending}
            aria-invalid={Boolean(errors.duration)}
            placeholder={days ? "7" : "60"}
            onChange={(event) => {
              clear("duration");
              setDuration(event.target.value.replace(/\D/g, "").slice(0, days ? 4 : 5));
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            {(days ? QUICK_DAYS : QUICK_MINUTES).map((value) => (
              <button
                key={value}
                type="button"
                disabled={pending}
                aria-pressed={duration === String(value)}
                onClick={() => {
                  clear("duration");
                  setDuration(String(value));
                }}
                className={PILL}
              >
                {value}
              </button>
            ))}
          </div>
          {errors.duration && (
            <p role="alert" className="text-destructive text-xs">
              {errors.duration}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Пункты правил</Label>
          <RulePicker
            value={rules}
            disabled={pending}
            invalid={Boolean(errors.rules)}
            onChange={(next) => {
              clear("rules");
              setRules(next);
            }}
          />
          {errors.rules && (
            <p role="alert" className="text-destructive text-xs">
              {errors.rules}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pun-forum">Жалоба на форуме</Label>
          <Input
            id="pun-forum"
            value={forum}
            disabled={pending}
            maxLength={L.forumMax}
            aria-invalid={Boolean(errors.forum)}
            placeholder="Garik-0018"
            autoComplete="off"
            onChange={(event) => {
              clear("forum");
              setForum(event.target.value.replace(/[\r\n]/g, ""));
            }}
          />
          <p className="text-muted-foreground text-xs">
            Необязательно. Название жалобы добавится в конец команды, администратор сможет его поправить.
          </p>
          {errors.forum && (
            <p role="alert" className="text-destructive text-xs">
              {errors.forum}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Доказательства</Label>
          <EvidenceField value={evidence} setValue={setEvidence} active disabled={pending} />
        </div>

        {serverError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          >
            {serverError}
          </p>
        )}

        <Button onClick={submit} disabled={pending}>
          <Send data-icon="inline-start" />
          {pending ? "Отправка..." : "Отправить заявку"}
        </Button>
      </CardContent>
    </Card>
  );
}
