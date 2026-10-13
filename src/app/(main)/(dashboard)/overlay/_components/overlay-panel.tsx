"use client";

import { useState } from "react";

import { Copy, Download, ExternalLink, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  files: { name: string; size: number; updatedAt: string }[];
  siteUrl: string;
  /** null — токен скрыт: не задан на сервере или нет права на быстрые ответы */
  token: string | null;
  tokenConfigured: boolean;
  externalUrl: string | null;
};

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  });

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} скопирован`);
  } catch {
    toast.error("Не удалось скопировать");
  }
}

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  return (
    <div className="space-y-1.5">
      <div className="hud-label text-muted-foreground text-xs uppercase tracking-widest">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded border bg-muted/40 px-3 py-2 font-mono text-sm">
          {shown ? value : "•".repeat(Math.min(value.length, 32))}
        </code>
        {secret ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={shown ? "Скрыть" : "Показать"}
            onClick={() => setShown((prev) => !prev)}
          >
            {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="icon" aria-label="Копировать" onClick={() => copy(value, label)}>
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

const STEPS = [
  "Скачайте файл .exe и запустите его. Установка и Node.js не нужны, значок оверлея появится в трее.",
  "Откройте вкладку «Настройки» оверлея и вставьте адрес сайта и токен из блока выше.",
  "Игра должна идти в режиме «в окне» или «окно без рамок»: поверх настоящего полноэкранного режима окно не видно.",
  "Alt+R показывает и скрывает оверлей, Alt+H показывает список биндов на экране игры. Клавиши можно сменить в настройках.",
];

export function OverlayPanel({ files, siteUrl, token, tokenConfigured, externalUrl }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <div className="text-muted-foreground text-xs uppercase tracking-widest">Администрация</div>
        <h1 className="mt-1 font-semibold text-2xl">Оверлей для игры</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Программа для компьютера: открывается поверх игры, ищет по правилам и быстрым ответам, отправляет бинды в чат.
        </p>
      </div>

      <Card className="gap-0 p-0">
        <div className="border-b px-5 py-3 font-medium text-sm">Скачать</div>
        <div className="divide-y">
          {externalUrl ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <div className="font-medium">Сборка для Windows</div>
                <div className="text-muted-foreground text-xs">Готовая программа, внешняя ссылка</div>
              </div>
              <Button asChild>
                <a href={externalUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> Открыть
                </a>
              </Button>
            </div>
          ) : null}
          {files.map((file) => (
            <div key={file.name} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="truncate font-medium font-mono text-sm">{file.name}</div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  {formatSize(file.size)} · обновлён {formatDate(file.updatedAt)}
                </div>
              </div>
              <Button asChild variant={externalUrl ? "outline" : "default"}>
                <a href={`/api/overlay/download?file=${encodeURIComponent(file.name)}`}>
                  <Download className="size-4" /> Скачать
                </a>
              </Button>
            </div>
          ))}
          {!externalUrl && files.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">
              Файлов пока нет. Положите сборку в папку overlay-downloads на сервере или задайте ссылку в переменной
              OVERLAY_DOWNLOAD_URL.
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="gap-4 p-5">
        <div className="font-medium text-sm">Подключение</div>
        {siteUrl ? <CopyField label="Адрес сайта" value={siteUrl} /> : null}
        {token ? (
          <CopyField label="Токен оверлея" value={token} secret />
        ) : (
          <div className="rounded border border-dashed px-4 py-3 text-muted-foreground text-sm">
            {tokenConfigured
              ? "Токен видят администраторы с доступом к быстрым ответам. Без него в оверлее будут только встроенные ответы."
              : "Токен не задан. Добавьте на сервере переменную OVERLAY_TOKEN (любая длинная случайная строка), иначе быстрые ответы в оверлей не попадут."}
          </div>
        )}
        <p className="text-muted-foreground text-xs">
          Не передавайте токен игрокам: с ним открываются быстрые ответы администрации.
        </p>
      </Card>

      <Card className="gap-3 p-5">
        <div className="font-medium text-sm">Установка</div>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
