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

/* ───────────── Макет окна оверлея: повторяет главную программы ───────────── */

const R_PATH =
  "M12.252 30.5459C13.1582 30.546 13.9836 31.0646 14.3721 31.8789L19.2012 42H10.3662C9.43069 41.9999 8.58456 41.4474 8.21289 40.5938L5.25879 33.8057C4.58842 32.2653 5.72408 30.5462 7.41211 30.5459H12.252ZM23.5176 0C28.6786 0 32.8302 1.44515 35.9707 4.33496C39.1311 7.20522 40.7109 10.8667 40.7109 15.3184C40.7109 16.9583 40.4713 18.5007 39.9912 19.9453C39.5313 21.3707 38.9709 22.5324 38.3105 23.4307C37.6505 24.3288 36.9905 25.1106 36.3301 25.7744C35.6902 26.4381 35.1398 26.9063 34.6797 27.1797L33.96 27.5898L42.2412 42H30.5635C29.4369 41.9998 28.4098 41.3584 27.9209 40.3496L23.2002 30.6064L16.918 18.5029H28.4326C29.1728 18.5029 29.5085 18.3499 30.2412 17.6592C30.7818 17.1494 30.9609 15.4236 30.9609 14.3184C30.9609 13.2132 30.0138 12.0773 29.458 11.6055C28.9022 11.1337 27.4473 10.9043 26.707 10.9043H13.6797L11.6523 6.38281C11.3709 5.75491 10.876 5.24535 10.2539 4.94531L0 0H23.5176Z";
const R_ACCENT_PATH =
  "M30.7194 13.3C30.4094 12.2523 29.9575 6.43445 24.9342 2.91666C21.9595 0.833447 18.01 -7.79511e-08 14.778 0C6.08842 2.09583e-07 0 0 0 0L6.60024 3.20833C7.49601 3.64038 10.4496 5.43981 11.7338 7.29167C13.0179 9.14352 13.6405 10.9043 13.6405 10.9043H26.7068C27.447 10.9043 28.9021 11.1335 29.458 11.6053C29.8167 11.9099 30.3944 12.6286 30.7194 13.3Z";

function MiniMark() {
  return (
    <svg viewBox="0 0 43 42" fill="none" aria-hidden className="h-6 w-auto shrink-0 overflow-visible">
      <path fill="#fff" d={R_PATH} />
      <path fill="url(#ov-mock-grad)" d={R_ACCENT_PATH} />
      <defs>
        <linearGradient id="ov-mock-grad" x1="0" y1="6.65" x2="30.7194" y2="6.65" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E63F3F" />
          <stop offset="1" stopColor="#AB2929" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function OverlayMock() {
  const nav = ["Правила", "Ответы", "Биндер"];
  const cards: { title: string; chips: string[] }[] = [
    { title: "Разделы правил", chips: ["ОП", "ОГ", "ПГ"] },
    { title: "Быстрые ответы", chips: ["Приветствие", "Ожидание"] },
  ];
  return (
    <div
      aria-hidden
      className="relative w-full select-none overflow-hidden rounded-xl border border-white/10 bg-[#131314] text-[#f0f0f2] shadow-2xl shadow-black/40"
    >
      <div className="flex items-center gap-3 border-white/8 border-b bg-[#0f0f10] px-3.5 py-3">
        <MiniMark />
        <span className="min-w-0 flex-1 truncate text-[15px]">
          огра<span className="ml-px inline-block h-4 w-px translate-y-0.5 bg-[#e63f3f]" />
        </span>
        <span className="flex rounded-full border border-white/8 bg-[#1b1b1d] p-0.5 text-[10px]">
          {["Всё", "Правила", "Ответы"].map((tab, i) => (
            <span key={tab} className={`rounded-full px-2 py-0.5 ${i === 0 ? "bg-[#2b2b2e] text-white" : "text-white/45"}`}>
              {tab}
            </span>
          ))}
        </span>
      </div>

      <div className="space-y-2 p-3">
        <div className="grid grid-cols-3 gap-2">
          {nav.map((item) => (
            <div key={item} className="rounded-lg border border-white/8 bg-[#1b1b1d] px-2.5 py-2">
              <div className="font-semibold text-[11px]">{item}</div>
              <div className="mt-0.5 h-1 w-8 rounded-full bg-white/10" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {cards.map((card) => (
            <div
              key={card.title}
              className="relative overflow-hidden rounded-xl border border-white/8 bg-[#1b1b1d] p-3"
            >
              <div
                className="pointer-events-none absolute -right-8 -bottom-10 size-24 rounded-full"
                style={{ background: "radial-gradient(closest-side, rgba(230,63,63,.28), transparent)" }}
              />
              <div className="relative font-extrabold text-[13px]">{card.title}</div>
              <div className="relative mt-2.5 flex flex-wrap gap-1.5">
                {card.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-md border border-white/8 bg-[#242427] px-2 py-1 font-semibold text-[10px]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div className="h-5" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-white/8 border-t bg-[#0f0f10] px-3.5 py-1.5 text-[10px] text-white/35">
        <span>Enter — копировать</span>
        <span>Ctrl+M — свернуть</span>
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
