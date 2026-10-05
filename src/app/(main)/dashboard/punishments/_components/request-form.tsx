"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type EvidenceItem, PUNISHMENT_LIMITS as L } from "@/lib/punishments/types";

import { createRequestAction } from "../_actions";
import { EvidenceField } from "./evidence-field";
import { RulePicker } from "./rule-picker";

const QUICK_MINUTES = [15, 30, 60, 120, 180, 300];

type Errors = Partial<Record<"staticId" | "minutes" | "rules", string>>;

/** Форма заявки на наказание для хелпера: статик, время, пункты правил, доказательства (необязательно). */
export function RequestForm() {
  const router = useRouter();
  const [staticId, setStaticId] = useState("");
  const [minutes, setMinutes] = useState("");
  const [rules, setRules] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const clear = (key: keyof Errors) => setErrors((current) => ({ ...current, [key]: undefined }));

  const submit = () => {
    const next: Errors = {};
    if (staticId === "") next.staticId = "Введите статик игрока";
    const time = Number(minutes);
    if (minutes === "") next.minutes = "Укажите время наказания";
    else if (time < L.minMinutes || time > L.maxMinutes) next.minutes = `От ${L.minMinutes} до ${L.maxMinutes} мин`;
    if (rules.length === 0) next.rules = "Выберите хотя бы один пункт правил";
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      try {
        const result = await createRequestAction({ staticId, minutes: time, rules, evidence });
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        toast.success("Заявка отправлена. Администраторы получили уведомление.");
        setStaticId("");
        setMinutes("");
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
          <Label htmlFor="pun-minutes">Время наказания, минут</Label>
          <Input
            id="pun-minutes"
            inputMode="numeric"
            value={minutes}
            disabled={pending}
            aria-invalid={Boolean(errors.minutes)}
            placeholder="60"
            onChange={(event) => {
              clear("minutes");
              setMinutes(event.target.value.replace(/\D/g, "").slice(0, 5));
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_MINUTES.map((value) => (
              <button
                key={value}
                type="button"
                disabled={pending}
                aria-pressed={minutes === String(value)}
                onClick={() => {
                  clear("minutes");
                  setMinutes(String(value));
                }}
                className="rounded-full border px-2.5 py-0.5 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-primary/10"
              >
                {value}
              </button>
            ))}
          </div>
          {errors.minutes && (
            <p role="alert" className="text-destructive text-xs">
              {errors.minutes}
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
