"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "cn";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { levelLabel, type ServerCommand } from "../_data/commands";
import { CommandActions } from "./command-actions";
import { CommandEditor } from "./command-editor";

/** Цвет каждого уровня. Классы записаны целиком, чтобы Tailwind их увидел. Уровни выше шестого берут цвета по кругу. */
const LEVEL_TONES = [
  "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300",
] as const;

const toneFor = (level: number) => LEVEL_TONES[(Math.max(level, 1) - 1) % LEVEL_TONES.length];

const GRID = "md:grid md:grid-cols-[5.5rem_minmax(0,14rem)_minmax(0,1fr)_minmax(0,1.4fr)] md:gap-x-4";
const GRID_EDITABLE =
  "md:grid md:grid-cols-[5.5rem_minmax(0,14rem)_minmax(0,1fr)_minmax(0,1.4fr)_5rem] md:gap-x-4";

export type EditorState = "on" | "off" | "unavailable";

const normalize = (value: string) => value.toLowerCase().replaceAll("ё", "е");

/** Подсветка найденного фрагмента внутри текста. */
function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const index = normalize(text).indexOf(normalize(needle));
  if (index === -1) return <>{text}</>;
  return (
    <Fragment>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-yellow-300/70 px-0.5 text-foreground dark:bg-yellow-400/40">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </Fragment>
  );
}

function LevelBadge({ level, className }: { level: number; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-semibold tabular-nums", toneFor(level), className)}>
      {levelLabel(level)}
    </Badge>
  );
}

/** Таблица команд сервера: сортировка по уровню, фильтр по уровням и поиск (Ctrl + F переводит фокус в поле поиска). */
export function CommandsTable({
  commands,
  editor = "off",
  problem = null,
}: {
  commands: readonly ServerCommand[];
  /** on: можно добавлять и менять; unavailable: право есть, но база недоступна; off: только чтение */
  editor?: EditorState;
  problem?: string | null;
}) {
  const grid = editor === "on" ? GRID_EDITABLE : GRID;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<readonly number[]>([]);
  const [descending, setDescending] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const levels = useMemo(() => [...new Set(commands.map((item) => item.level))].sort((a, b) => a - b), [commands]);

  // Ctrl + F (⌘ + F на Mac) ищет по разделу вместо встроенного поиска браузера
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === "KeyF") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    return commands
      .filter((item) => {
        if (selected.length > 0 && !selected.includes(item.level)) return false;
        if (!needle) return true;
        return normalize(`${levelLabel(item.level)} ${item.command} ${item.argument} ${item.description}`).includes(needle);
      })
      .sort(
        (a, b) => (descending ? b.level - a.level : a.level - b.level) || a.command.localeCompare(b.command, "ru"),
      );
  }, [commands, query, selected, descending]);

  const toggle = (level: number) =>
    setSelected((current) => (current.includes(level) ? current.filter((item) => item !== level) : [...current, level]));

  const filtering = query.trim() !== "" || selected.length > 0;
  const SortIcon = descending ? ArrowDownWideNarrow : ArrowUpNarrowWide;

  return (
    <div className="flex w-full flex-col gap-4 md:gap-6">
      <section className="relative px-2 pt-12 pb-2 sm:pt-6 md:px-6 md:pt-8">
        {editor === "on" && (
          <div className="absolute top-0 right-0 sm:top-1 md:top-2">
            <CommandEditor mode="create" defaultLevel={selected.length === 1 ? selected[0] : 1} />
          </div>
        )}
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Команды сервера</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Команды сгруппированы по уровню доступа. Цвет уровня одинаков в таблице и в фильтре.
          </p>

          <div className="relative mt-7 w-full">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                  event.currentTarget.blur();
                }
              }}
              placeholder="Поиск по командам, аргументам и описанию"
              aria-label="Поиск по командам сервера"
              aria-keyshortcuts="Control+F"
              className="h-11 rounded-xl pr-24 pl-10"
            />
            <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1">
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  aria-label="Очистить поиск"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : (
                <kbd className="pointer-events-none hidden rounded-md border bg-muted/50 px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:inline-block">
                  Ctrl + F
                </kbd>
              )}
            </div>
          </div>

          <div className="mt-4 flex max-w-full flex-wrap items-center justify-center gap-2">
            {levels.map((level) => {
              const active = selected.includes(level);
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(level)}
                  className={cn(
                    "rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50",
                    active ? "ring-2 ring-ring" : selected.length > 0 ? "opacity-50 hover:opacity-100" : "hover:opacity-80",
                  )}
                >
                  <LevelBadge level={level} className="h-7 cursor-pointer px-3 text-xs" />
                </button>
              );
            })}
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
              >
                Сбросить уровни
              </button>
            )}
            <button
              type="button"
              onClick={() => setDescending((value) => !value)}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-background px-3 text-xs outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <SortIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {descending ? "Сначала высокие уровни" : "Сначала низкие уровни"}
            </button>
          </div>
        </div>
      </section>

      {editor === "unavailable" && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700 text-sm dark:text-amber-300">
          Редактирование недоступно: нет связи с базой данных{problem ? ` (${problem})` : ""}. Показаны встроенные
          команды.
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          {commands.length === 0
            ? "Команд пока нет."
            : "Ничего не нашли: попробуйте изменить запрос или выбранные уровни."}
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {filtering ? `Найдено: ${visible.length} из ${commands.length}` : `Всего команд: ${commands.length}`}
          </p>
          <Card className="gap-0 overflow-hidden py-0">
            <div
              aria-hidden="true"
              className={cn(
                "hidden border-b bg-muted/40 px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide",
                grid,
              )}
            >
              <span>Уровень</span>
              <span>Команда</span>
              <span>Аргумент</span>
              <span>Описание</span>
              {editor === "on" && <span className="text-right">Действия</span>}
            </div>
            <ul className="divide-y">
              {visible.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-muted/40 md:items-center md:gap-y-0",
                    grid,
                  )}
                >
                  <div>
                    <LevelBadge level={item.level} />
                  </div>
                  <code className="break-all font-mono font-semibold text-sm">
                    <Highlight text={item.command} query={query} />
                  </code>
                  <code className="break-words font-mono text-muted-foreground text-xs">
                    {item.argument ? <Highlight text={item.argument} query={query} /> : "—"}
                  </code>
                  <p className="text-sm">
                    <Highlight text={item.description} query={query} />
                  </p>
                  {editor === "on" && (
                    <div className="md:flex md:justify-end">
                      <CommandActions item={item} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
