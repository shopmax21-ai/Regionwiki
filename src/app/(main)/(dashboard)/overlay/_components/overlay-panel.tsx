"use client";

import { useState } from "react";

import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  Gamepad2,
  KeyRound,
  Laptop,
  MonitorPlay,
  ShieldCheck,
} from "lucide-react";
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
  const downloads = files.length + (externalUrl ? 1 : 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="border-b pb-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">Game utilities / 01</p>
            <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">Игровой оверлей</h1>
            <p className="mt-3 max-w-xl text-muted-foreground text-sm leading-6 sm:text-base">
              Правила, быстрые ответы и служебные материалы — в одном окне поверх игры. Установите приложение и настройте его один раз.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-5 border-l pl-5 text-sm">
            <div><MonitorPlay className="mb-2 size-4 text-primary" /><span className="font-medium">Alt+R</span><p className="mt-1 text-muted-foreground text-xs">Открыть</p></div>
            <div><Gamepad2 className="mb-2 size-4 text-primary" /><span className="font-medium">Alt+H</span><p className="mt-1 text-muted-foreground text-xs">Бинды</p></div>
            <div><Laptop className="mb-2 size-4 text-primary" /><span className="font-medium">Windows</span><p className="mt-1 text-muted-foreground text-xs">Платформа</p></div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <FileDown className="size-4" />
              </div>
              <div>
                <h2 className="font-medium text-sm">Дистрибутив</h2>
                <p className="text-muted-foreground text-xs">Версия для Windows</p>
              </div>
            </div>
            <div className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground text-xs tabular-nums">
              {downloads} {downloads === 1 ? "файл" : "файла"}
            </div>
          </div>
          <div className="divide-y">
            {externalUrl ? (
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
                <div>
                  <div className="font-medium">Актуальная сборка</div>
                  <div className="mt-1 text-muted-foreground text-xs">Рекомендуемый способ установки</div>
                </div>
                <Button asChild>
                  <a href={externalUrl} target="_blank" rel="noreferrer">
                    <ExternalLink data-icon="inline-start" /> Открыть загрузку
                  </a>
                </Button>
              </div>
            ) : null}
            {files.map((file) => (
              <div key={file.name} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
                <div className="min-w-0">
                  <div className="truncate font-medium font-mono text-sm">{file.name}</div>
                  <div className="mt-1 text-muted-foreground text-xs tabular-nums">
                    {formatSize(file.size)} · обновлён {formatDate(file.updatedAt)}
                  </div>
                </div>
                <Button asChild variant={externalUrl ? "outline" : "default"}>
                  <a href={`/api/overlay/download?file=${encodeURIComponent(file.name)}`}>
                    <Download data-icon="inline-start" /> Скачать
                  </a>
                </Button>
              </div>
            ))}
            {!externalUrl && files.length === 0 ? (
              <div className="px-6 py-10 text-center text-muted-foreground text-sm">
                Файлов пока нет. Добавьте сборку на сервер или задайте <code>OVERLAY_DOWNLOAD_URL</code>.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="gap-5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <KeyRound className="size-4" />
            </div>
            <div>
              <h2 className="font-medium text-sm">Данные подключения</h2>
              <p className="mt-1 text-muted-foreground text-xs">Скопируйте их в настройках программы</p>
            </div>
          </div>
          {siteUrl ? <CopyField label="Адрес сайта" value={siteUrl} /> : null}
          {token ? (
            <CopyField label="Токен оверлея" value={token} secret />
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-3 text-muted-foreground text-sm">
              {tokenConfigured
                ? "Токен доступен администраторам с правом просмотра быстрых ответов."
                : "Токен не задан. Добавьте переменную OVERLAY_TOKEN на сервере."}
            </div>
          )}
          <div className="flex gap-2 text-muted-foreground text-xs leading-5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /> Не передавайте токен игрокам: он открывает
            быстрые ответы администрации.
          </div>
        </Card>
      </div>

      <Card className="gap-5 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Check className="size-4" />
          </div>
          <div>
            <h2 className="font-medium text-sm">Быстрый старт</h2>
            <p className="mt-1 text-muted-foreground text-xs">Четыре шага до первого запуска</p>
          </div>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-xs">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
