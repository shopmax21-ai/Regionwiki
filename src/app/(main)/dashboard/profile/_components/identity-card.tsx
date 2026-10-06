"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Save } from "lucide-react";
import { toast } from "sonner";

import { PersonName } from "@/components/person-name";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IDENTITY_LIMITS, validateIdentity } from "@/lib/auth/identity";
import type { Person } from "@/lib/auth/person";

import { saveIdentity } from "../_actions";

/**
 * Игровой профиль администратора: Никнейм и Statik ID. Если указаны, на сайте вместо имени из Telegram показывается
 * «иконка роли Никнейм иконка ID Статик». Ниже живой предпросмотр того, как это будет выглядеть.
 */
export function IdentityCard({ person }: { person: Person }) {
  const router = useRouter();
  const [nickname, setNickname] = useState(person.nickname ?? "");
  const [staticId, setStaticId] = useState(person.staticId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const check = validateIdentity({ nickname, staticId });
  const dirty = (person.nickname ?? "") !== nickname.trim() || (person.staticId ?? "") !== staticId.trim();

  // Предпросмотр строится из того, что сейчас в полях; пока значение некорректно, показываем сохранённое
  const preview: Person = check.ok
    ? { ...person, nickname: check.value.nickname, staticId: check.value.staticId }
    : person;

  const submit = () => {
    setError(null);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveIdentity({ nickname, staticId });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success("Профиль сохранён");
        router.refresh();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Игровой профиль</CardTitle>
        <CardDescription>
          Никнейм и Statik ID показываются на сайте рядом с иконкой вашей роли: в заявках на наказания, календаре,
          результатах тестов и списках администрации.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-nickname">Никнейм</Label>
            <Input
              id="profile-nickname"
              value={nickname}
              maxLength={IDENTITY_LIMITS.nicknameMax}
              disabled={pending}
              autoComplete="off"
              placeholder="Garik_Brown"
              onChange={(event) => {
                setError(null);
                setNickname(event.target.value.replace(/[\r\n]/g, ""));
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-static">Statik ID</Label>
            <Input
              id="profile-static"
              inputMode="numeric"
              value={staticId}
              disabled={pending}
              autoComplete="off"
              placeholder="5443"
              onChange={(event) => {
                setError(null);
                setStaticId(event.target.value.replace(/\D/g, "").slice(0, IDENTITY_LIMITS.staticMaxDigits));
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">Так вас будут видеть на сайте</span>
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <PersonName person={preview} />
          </div>
          <span className="text-muted-foreground text-xs">
            Пока Никнейм не указан, показывается имя из Telegram. Пустые поля можно оставить.
          </span>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          >
            {error}
          </p>
        )}

        <div>
          <Button onClick={submit} disabled={pending || !dirty}>
            <Save data-icon="inline-start" />
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
