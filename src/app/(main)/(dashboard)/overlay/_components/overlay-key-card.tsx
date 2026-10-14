"use client";

import { useState } from "react";

import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { createOverlayTokenAction, revokeOverlayTokenAction } from "../_actions";

export type OverlayKeyInfo = { createdAt: string; lastUsedAt: string | null };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  });

/**
 * Ключ доступа оверлея: создаётся здесь и вставляется в приложение. Он уже содержит адрес сайта, а права берутся
 * из вашего профиля: правила, быстрые ответы и наказания открываются ровно в том объёме, что и на сайте.
 * Используется в профиле и на странице «Оверлей».
 */
export function OverlayKeyCard({ info }: { info: OverlayKeyInfo | null }) {
  const [current, setCurrent] = useState(info);
  const [fresh, setFresh] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const copyKey = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Ключ скопирован. Откройте оверлей: он подхватит его из буфера обмена");
    } catch {
      toast.error("Не удалось скопировать, выделите ключ вручную");
    }
  };

  const create = async () => {
    setBusy(true);
    const result = await createOverlayTokenAction().catch(() => ({ ok: false as const, error: "Нет связи с сервером" }));
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setFresh(result.token);
    setShown(false);
    setCurrent({ createdAt: new Date().toISOString(), lastUsedAt: null });
    await copyKey(result.token);
  };

  const revoke = async () => {
    setBusy(true);
    const result = await revokeOverlayTokenAction().catch(() => ({ ok: false, error: "Нет связи с сервером" }));
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Не удалось отозвать ключ");
      return;
    }
    setFresh(null);
    setCurrent(null);
    toast.success("Ключ отозван, оверлей с ним больше не работает");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Оверлей для игры</CardTitle>
        <CardDescription>
          Один ключ подключает приложение к сайту: ссылку вводить не нужно. Правила, быстрые ответы и наказания
          открываются по вашим правам на сайте.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fresh ? (
          <div className="space-y-2">
            <div className="flex items-stretch gap-2">
              <code className="flex min-w-0 flex-1 items-center truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-[13px]">
                {shown ? fresh : "•".repeat(32)}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={shown ? "Скрыть ключ" : "Показать ключ"}
                onClick={() => setShown((value) => !value)}
              >
                {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button type="button" variant="outline" size="icon" aria-label="Копировать ключ" onClick={() => copyKey(fresh)}>
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Ключ показывается только сейчас, на сайте хранится лишь его отпечаток. Он уже скопирован: откройте
              оверлей, и он подключится сам. Никому не передавайте ключ.
            </p>
          </div>
        ) : current ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Ключ создан {formatDate(current.createdAt)}
            {current.lastUsedAt
              ? `, оверлей обращался к сайту ${formatDate(current.lastUsedAt)}`
              : ", оверлей ещё не подключался"}
            . Сам ключ не хранится, при потере создайте новый.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">Ключа ещё нет. Создайте его и откройте оверлей.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={current ? "outline" : "default"} disabled={busy} onClick={create}>
            {current ? "Создать новый ключ" : "Создать ключ"}
          </Button>
          {current ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={revoke}>
              Отозвать
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
