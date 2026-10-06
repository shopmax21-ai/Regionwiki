"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Lock, Save } from "lucide-react";
import { toast } from "sonner";

import { PersonName } from "@/components/person-name";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IDENTITY_LIMITS, identityLocked, validateFirstIdentity, validateIdentity } from "@/lib/auth/identity";
import type { Person } from "@/lib/auth/person";

import { saveIdentity, saveStaffIdentity } from "../_actions";

type IdentityCardProps = {
  person: Person;
  /**
   * "self": свой профиль. Указать можно один раз, потом поля закрыты.
   * "staff": профиль нижестоящего администратора, его правит вышестоящий.
   */
  mode: "self" | "staff";
};

/**
 * Игровой профиль администратора: Никнейм и Static ID. Если указаны, на сайте вместо имени из Telegram показывается
 * «иконка роли Никнейм иконка ID Статик». Ниже живой предпросмотр того, как это будет выглядеть.
 * Сам администратор указывает их один раз, дальше меняет только вышестоящий.
 */
export function IdentityCard({ person, mode }: IdentityCardProps) {
  const router = useRouter();
  const [nickname, setNickname] = useState(person.nickname ?? "");
  const [staticId, setStaticId] = useState(person.staticId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const own = mode === "self";
  // В своём профиле поля закрываются, как только значения сохранены
  const locked = own && identityLocked(person);

  const check = own && !locked ? validateFirstIdentity({ nickname, staticId }) : validateIdentity({ nickname, staticId });
  const dirty = (person.nickname ?? "") !== nickname.trim() || (person.staticId ?? "") !== staticId.trim();

  // Предпросмотр строится из того, что сейчас в полях; пока значение некорректно, показываем сохранённое
  const preview: Person = check.ok
    ? { ...person, nickname: check.value.nickname, staticId: check.value.staticId }
    : person;

  const submit = () => {
    setError(null);
    setConfirmOpen(false);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    startTransition(async () => {
      try {
        const result = own
          ? await saveIdentity({ nickname, staticId })
          : await saveStaffIdentity(person.id, { nickname, staticId });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(own ? "Профиль сохранён" : "Данные администратора обновлены");
        router.refresh();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  // Первое сохранение необратимо для самого администратора, поэтому просим подтвердить
  const onSave = () => {
    setError(null);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    if (own) setConfirmOpen(true);
    else submit();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Игровой профиль</CardTitle>
        <CardDescription>
          {own
            ? "Никнейм и Static ID показываются на сайте рядом с иконкой вашей роли: в заявках на наказания, календаре, результатах тестов и списках администрации. Указать их можно один раз."
            : "Вы стоите выше этого администратора, поэтому можете исправить его Никнейм и Static ID. Пустые поля очищают значение."}
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
              disabled={pending || locked}
              autoComplete="off"
              placeholder="Garik_Brown"
              onChange={(event) => {
                setError(null);
                setNickname(event.target.value.replace(/[\r\n]/g, ""));
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-static">Static ID</Label>
            <Input
              id="profile-static"
              inputMode="numeric"
              value={staticId}
              disabled={pending || locked}
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
          {!locked && (
            <span className="text-muted-foreground text-xs">
              {own
                ? "Нужны оба поля. После сохранения изменить их сможет только вышестоящий администратор."
                : "Пока Никнейм не указан, показывается имя из Telegram."}
            </span>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          >
            {error}
          </p>
        )}

        {locked ? (
          <p className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            Данные указаны. Изменить их может только вышестоящий администратор.
          </p>
        ) : (
          <div>
            <Button onClick={onSave} disabled={pending || !dirty}>
              <Save data-icon="inline-start" />
              {pending ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сохранить Никнейм и Static ID?</AlertDialogTitle>
            <AlertDialogDescription>
              Указать их можно только один раз. Потом исправить их сможет лишь вышестоящий администратор. Проверьте,
              что всё написано верно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <PersonName person={preview} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>Сохранить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
