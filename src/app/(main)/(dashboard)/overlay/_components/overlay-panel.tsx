"use client";

import { useState } from "react";

import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Keyboard,
  MessageSquareText,
  Monitor,
  Search,
  TriangleAlert,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

type Props = {
  files: { name: string; size: number; updatedAt: string }[];
  siteUrl: string;
  /** null — токен скрыт: не задан на сервере или нет права на быстрые ответы */
  token: string | null;
  tokenConfigured: boolean;
  externalUrl: string | null;
};

/** Акцент Region: тот же красный, что на страницах входа */
const ACCENT = "oklch(0.585 0.235 27)";

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
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

/* ───────────── Макет окна оверлея: показывает, что человек получит в игре ───────────── */

function OverlayMock() {
  const tabs = ["Всё", "Правила", "Ответы", "Биндер"];
  return (
    <div
      aria-hidden
      className="relative w-full select-none overflow-hidden rounded-xl border border-white/10 bg-[#121214] text-[#e8e8ea] shadow-2xl shadow-black/40"
    >
      <div className="flex items-center gap-2 border-white/8 border-b px-3 py-2">
        <span
          className="grid size-5 place-items-center rounded font-bold text-[11px] text-white"
          style={{ background: ACCENT }}
        >
          R
        </span>
        <div className="flex gap-0.5 text-[11px]">
          {tabs.map((tab, i) => (
            <span
              key={tab}
              className={`rounded px-2 py-1 ${i === 0 ? "bg-white/10 text-white" : "text-white/45"}`}
            >
              {tab}
            </span>
          ))}
        </div>
        <span className="ml-auto font-mono text-[10px] text-white/35">Alt+R</span>
      </div>

      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-md border border-white/12 bg-black/30 px-3 py-2 text-sm">
          <Search className="size-3.5 text-white/40" />
          <span>ограбить</span>
          <span className="-ml-1 h-4 w-px bg-white/70" />
        </div>
      </div>

      <ul className="space-y-1 p-3 text-[13px]">
        <li className="flex items-center gap-3 rounded-md bg-white/[0.07] px-3 py-2 ring-1 ring-white/10">
          <span className="font-mono text-xs" style={{ color: ACCENT }}>
            ОП 1.19
          </span>
          <span className="min-w-0 flex-1 truncate text-white/80">Ограбления и похищения</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/55">Правило</span>
        </li>
        <li className="flex items-center gap-3 rounded-md px-3 py-2">
          <span className="font-mono text-white/45 text-xs">Ответ</span>
          <span className="min-w-0 flex-1 truncate text-white/70">Жалоба передана, ожидайте решения</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/55">Копировать</span>
        </li>
        <li className="flex items-center gap-3 rounded-md px-3 py-2">
          <span className="font-mono text-white/45 text-xs">Бинд</span>
          <span className="min-w-0 flex-1 truncate text-white/70">Приветствие ×2</span>
          <span className="font-mono text-[10px] text-white/45">Ctrl+Alt+1</span>
        </li>
      </ul>

      <div className="flex items-center justify-between border-white/8 border-t px-3 py-1.5 font-mono text-[10px] text-white/35">
        <span>Enter — копировать</span>
        <span>Shift+Enter — с текстом</span>
      </div>
    </div>
  );
}

/* ───────────── Поле с копированием ───────────── */

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  const [done, setDone] = useState(false);

  const onCopy = async () => {
    await copy(value, label);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };

  return (
    <div className="space-y-1.5">
      <div className="font-medium text-sm">{label}</div>
      <div className="flex items-stretch gap-2">
        <code className="flex min-w-0 flex-1 items-center truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-[13px]">
          {shown ? value : "•".repeat(Math.min(value.length, 36))}
        </code>
        {secret ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={shown ? "Скрыть токен" : "Показать токен"}
            onClick={() => setShown((prev) => !prev)}
          >
            {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="icon" aria-label={`Копировать: ${label}`} onClick={onCopy}>
          {done ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

/* ───────────── Данные ───────────── */

const FEATURES = [
  {
    icon: Search,
    title: "Поиск по правилам",
    text: "Номер («ОП 1.19») или слова из ситуации, окончания учитываются. Enter копирует номер, Shift+Enter — вместе с текстом.",
  },
  {
    icon: MessageSquareText,
    title: "Быстрые ответы",
    text: "Клик по ответу копирует его. Можно включить автовставку: окно скроется, а текст вставится в чат игры.",
  },
  {
    icon: Keyboard,
    title: "Биндер",
    text: "Сочетание клавиш отправляет в чат одно или несколько сообщений подряд. Пауза и клавиша чата настраиваются.",
  },
  {
    icon: Monitor,
    title: "Подсказки поверх игры",
    text: "Прозрачная панель со списком биндов не перехватывает мышь. Угол экрана, размер и прозрачность — в настройках.",
  },
];

const HOTKEYS: { keys: string[]; label: string }[] = [
  { keys: ["Alt", "R"], label: "Показать или скрыть оверлей" },
  { keys: ["Alt", "H"], label: "Список биндов на экране игры" },
  { keys: ["Ctrl", "M"], label: "Свернуть до строки поиска" },
  { keys: ["Ctrl", "1…5"], label: "Переключение вкладок" },
  { keys: ["Esc"], label: "Очистить поиск, затем скрыть" },
];

/* ───────────── Страница ───────────── */

export function OverlayPanel({ files, siteUrl, token, tokenConfigured, externalUrl }: Props) {
  const latest = files[0] ?? null;
  const olderFiles = files.slice(1);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 pb-10" style={{ ["--ov" as string]: ACCENT }}>
      {/* Верх: заголовок, скачивание и живой макет */}
      <section className="grid items-center gap-8 lg:grid-cols-[1fr_minmax(0,26rem)]">
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
              Правила и ответы
              <br />
              прямо поверх игры
            </h1>
            <p className="max-w-md text-muted-foreground leading-relaxed">
              Программа для Windows: ищет по правилам, копирует быстрые ответы и отправляет бинды в чат, не заставляя
              сворачивать игру.
            </p>
          </div>

          <div className="space-y-3">
            {externalUrl ? (
              <Button asChild size="lg" className="bg-(--ov) text-white hover:bg-(--ov)/90">
                <a href={externalUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> Скачать для Windows
                </a>
              </Button>
            ) : latest ? (
              <Button asChild size="lg" className="bg-(--ov) text-white hover:bg-(--ov)/90">
                <a href={`/api/overlay/download?file=${encodeURIComponent(latest.name)}`}>
                  <Download className="size-4" /> Скачать для Windows
                </a>
              </Button>
            ) : (
              <div className="max-w-md rounded-lg border border-dashed px-4 py-3 text-muted-foreground text-sm">
                Сборки пока нет. Положите файл в папку overlay-downloads на сервере или задайте ссылку в переменной
                OVERLAY_DOWNLOAD_URL.
              </div>
            )}

            {latest && !externalUrl ? (
              <p className="text-muted-foreground text-sm tabular-nums">
                <span className="font-mono text-xs">{latest.name}</span>, {formatSize(latest.size)}, обновлён{" "}
                {formatDate(latest.updatedAt)}
              </p>
            ) : null}
            {externalUrl ? <p className="text-muted-foreground text-sm">Готовая сборка по внешней ссылке</p> : null}
          </div>

          {(externalUrl && files.length > 0) || olderFiles.length > 0 ? (
            <details className="group max-w-md text-sm">
              <summary className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground">
                Другие файлы ({externalUrl ? files.length : olderFiles.length})
              </summary>
              <ul className="mt-2 divide-y rounded-lg border">
                {(externalUrl ? files : olderFiles).map((file) => (
                  <li key={file.name} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs">{file.name}</div>
                      <div className="text-muted-foreground text-xs tabular-nums">
                        {formatSize(file.size)}, {formatDate(file.updatedAt)}
                      </div>
                    </div>
                    <Button asChild variant="ghost" size="icon" aria-label={`Скачать ${file.name}`}>
                      <a href={`/api/overlay/download?file=${encodeURIComponent(file.name)}`}>
                        <Download className="size-4" />
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <OverlayMock />
      </section>

      {/* Возможности */}
      <section className="grid gap-x-10 gap-y-8 border-t pt-10 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-4">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-(--ov)/10 text-(--ov)">
              <Icon className="size-[18px]" />
            </span>
            <div className="space-y-1">
              <h2 className="font-medium text-[15px]">{title}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Установка: это действительно последовательность шагов */}
      <section className="space-y-6">
        <h2 className="font-semibold text-xl">Установка за три шага</h2>

        <ol className="relative space-y-8 border-l pl-8">
          <li className="relative">
            <span className="-left-[2.6rem] absolute top-0 grid size-5 place-items-center rounded-full bg-(--ov) font-semibold text-[11px] text-white">
              1
            </span>
            <h3 className="font-medium">Запустите файл</h3>
            <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
              Скачайте .exe и откройте его. Ставить Node.js не нужно, значок оверлея появится в трее.
            </p>
          </li>

          <li className="relative">
            <span className="-left-[2.6rem] absolute top-0 grid size-5 place-items-center rounded-full bg-(--ov) font-semibold text-[11px] text-white">
              2
            </span>
            <h3 className="font-medium">Подключите к сайту</h3>
            <p className="mt-1 mb-4 text-muted-foreground text-sm leading-relaxed">
              Вкладка «Настройки» в оверлее: вставьте адрес сайта и токен.
            </p>

            <div className="max-w-xl space-y-4 rounded-xl border bg-card p-4">
              {siteUrl ? <CopyField label="Адрес сайта" value={siteUrl} /> : null}
              {token ? (
                <CopyField label="Токен оверлея" value={token} secret />
              ) : (
                <div className="rounded-md border border-dashed px-3 py-2.5 text-muted-foreground text-sm">
                  {tokenConfigured
                    ? "Токен видят администраторы с доступом к быстрым ответам. Без него в оверлее будут только встроенные ответы."
                    : "Токен не задан. Добавьте на сервере переменную OVERLAY_TOKEN (любая длинная случайная строка), иначе быстрые ответы в оверлей не попадут."}
                </div>
              )}
              {token ? (
                <p className="text-muted-foreground text-xs">
                  Не передавайте токен игрокам: с ним открываются быстрые ответы администрации.
                </p>
              ) : null}
            </div>
          </li>

          <li className="relative">
            <span className="-left-[2.6rem] absolute top-0 grid size-5 place-items-center rounded-full bg-(--ov) font-semibold text-[11px] text-white">
              3
            </span>
            <h3 className="font-medium">Запустите игру в окне</h3>
            <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
              Режим «в окне» или «окно без рамок». Alt+R открывает оверлей, Alt+H показывает бинды.
            </p>
            <div className="mt-3 flex max-w-xl gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <span className="text-muted-foreground leading-relaxed">
                Поверх настоящего полноэкранного режима окно не видно. Если игра запущена от администратора, запускайте
                оверлей тоже от администратора.
              </span>
            </div>
          </li>
        </ol>
      </section>

      {/* Горячие клавиши */}
      <section className="space-y-4">
        <h2 className="font-semibold text-xl">Горячие клавиши</h2>
        <div className="divide-y rounded-xl border">
          {HOTKEYS.map(({ keys, label }) => (
            <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm">{label}</span>
              <KbdGroup>
                {keys.map((key, i) => (
                  <span key={key} className="flex items-center gap-1">
                    {i > 0 ? <span className="text-muted-foreground text-xs">+</span> : null}
                    <Kbd className="h-6 min-w-6 px-1.5">{key}</Kbd>
                  </span>
                ))}
              </KbdGroup>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">Все сочетания меняются в настройках оверлея.</p>
      </section>
    </div>
  );
}
