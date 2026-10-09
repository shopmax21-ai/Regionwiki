"use client";

import { type FormEvent, useState, useTransition } from "react";

import { Fingerprint, Shield, User } from "lucide-react";

import { adminGroups, groupInfo } from "@/lib/auth/groups";
import { IDENTITY_LIMITS, validateOnboarding } from "@/lib/auth/identity";

import { completeOnboarding } from "../_actions";
import { AuthField } from "./auth-field";
import { authButtonClass } from "./auth-styles";

/** Анкета первой авторизации: Никнейм, Static ID и предположительный уровень администрации. */
export function OnboardingForm({ askGroup }: { askGroup: boolean }) {
  const [nickname, setNickname] = useState("");
  const [staticId, setStaticId] = useState("");
  const [group, setGroup] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const check = validateOnboarding({ nickname, staticId, group }, { groupRequired: askGroup });
    if (!check.ok) return setError(check.error);

    startTransition(async () => {
      try {
        const result = await completeOnboarding({ nickname, staticId, group });
        if (!result.ok) return setError(result.error);
        window.location.assign(result.status === "approved" ? "/" : "/auth/v2/pending");
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <AuthField
          icon={<User />}
          value={nickname}
          maxLength={IDENTITY_LIMITS.nicknameMax}
          placeholder="Никнейм (Garik_Brown)"
          aria-label="Никнейм"
          autoComplete="off"
          disabled={pending}
          onChange={(event) => {
            setError(null);
            setNickname(event.target.value.replace(/[\r\n]/g, ""));
          }}
        />
        <AuthField
          icon={<Fingerprint />}
          value={staticId}
          inputMode="numeric"
          placeholder="Static ID (5443)"
          aria-label="Static ID"
          autoComplete="off"
          disabled={pending}
          onChange={(event) => {
            setError(null);
            setStaticId(event.target.value.replace(/\D/g, "").slice(0, IDENTITY_LIMITS.staticMaxDigits));
          }}
        />
        {askGroup && (
          <div className="flex flex-col gap-1.5">
            <div className="group relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
                <Shield />
              </span>
              <select
                value={group}
                disabled={pending}
                aria-label="Предположительный уровень администрации"
                onChange={(event) => {
                  setError(null);
                  setGroup(event.target.value);
                }}
                className="h-11 w-full appearance-none rounded-lg bg-foreground/[0.07] pr-3 pl-10 text-foreground text-sm outline-none ring-1 ring-transparent transition hover:bg-foreground/[0.09] focus-visible:ring-primary/60"
              >
                <option value="" disabled>
                  Предположительный уровень администрации
                </option>
                {adminGroups.map((value) => (
                  <option key={value} value={value} className="bg-background">
                    {groupInfo[value].label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-muted-foreground text-xs">
              Это лишь ваше предположение: итоговый уровень назначит вышестоящий администратор.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className={authButtonClass}>
        {pending ? "Сохраняем…" : "Продолжить"}
      </button>
    </form>
  );
}
