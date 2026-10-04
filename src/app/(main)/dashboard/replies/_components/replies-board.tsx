"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { LayoutGrid, Rows3, Search, Sparkles, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";

import type { QuickReply } from "../_data/replies";
import { ReplyCard } from "./reply-card";
import { ReplyEditor } from "./reply-editor";

type Layout = "rows" | "columns";

const LAYOUT_KEY = "region-replies-layout";
const ALL = "Все";

/** Кнопка показывает вид, на который переключит нажатие. */
const nextLayout: Record<Layout, { id: Layout; label: string; icon: typeof Rows3 }> = {
  columns: { id: "rows", label: "Показать в строку", icon: Rows3 },
  rows: { id: "columns", label: "Показать в 2 столбца", icon: LayoutGrid },
};

const isLayout = (value: string | null): value is Layout => value === "rows" || value === "columns";

/** "on" — можно менять, "off" — только копировать, "unavailable" — права есть, но база не подключена. */
type EditorState = "on" | "off" | "unavailable";

export function RepliesBoard({
  replies,
  editor,
  problem,
}: {
  replies: QuickReply[];
  editor: EditorState;
  problem?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [layout, setLayout] = useState<Layout>("columns");

  // Выбранный вид запоминается в браузере. Читаем после загрузки, чтобы не ломать серверную разметку.
  useEffect(() => {
    const saved = getLocalStorageValue(LAYOUT_KEY);
    if (isLayout(saved)) setLayout(saved);
  }, []);

  const toggleLayout = () => {
    const next = nextLayout[layout].id;
    setLayout(next);
    setLocalStorageValue(LAYOUT_KEY, next);
  };

  const toggle = nextLayout[layout];
  const ToggleIcon = toggle.icon;

  const categories = useMemo(() => Array.from(new Set(replies.map((reply) => reply.category))), [replies]);
  // Если выбранную категорию удалили вместе с последним ответом, возвращаемся ко всем
  const activeCategory = category === ALL || categories.includes(category) ? category : ALL;

  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const byCategory = new Map<string, QuickReply[]>();

    for (const reply of replies) {
      if (activeCategory !== ALL && reply.category !== activeCategory) continue;
      if (normalized && !`${reply.title} ${reply.text} ${reply.category}`.toLowerCase().includes(normalized)) continue;
      const list = byCategory.get(reply.category);
      if (list) list.push(reply);
      else byCategory.set(reply.category, [reply]);
    }
    return Array.from(byCategory, ([name, items]) => ({ name, items }));
  }, [replies, activeCategory, query]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-col items-center gap-3 py-4 text-center md:py-6">
        <Badge variant="secondary" className="gap-2 rounded-full px-3 py-1">
          <Sparkles data-icon="inline-start" /> Для персонала
        </Badge>
        <h1 className="font-semibold text-3xl tracking-tight md:text-5xl">Быстрые ответы</h1>
        <p className="max-w-xl text-muted-foreground text-sm md:text-base">
          Готовые ответы на репорты. Нажмите на карточку, и текст скопируется в буфер обмена.
        </p>
      </header>

      {editor === "unavailable" && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-dashed p-4 text-muted-foreground text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Редактирование временно недоступно, показаны встроенные ответы.
            {problem && (
              <>
                {" "}
                Причина: <code className="break-all text-xs">{problem}</code>
              </>
            )}
          </span>
        </div>
      )}

      <section className="flex flex-col gap-3" aria-label="Фильтры ответов">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по названию и тексту..."
              aria-label="Поиск быстрых ответов"
              className="h-10 pl-9"
            />
          </div>

          <div className="flex items-center gap-2 max-lg:justify-between">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 shrink-0"
              onClick={toggleLayout}
              aria-label={toggle.label}
              title={toggle.label}
            >
              <ToggleIcon className="size-4" aria-hidden="true" />
            </Button>

            {editor === "on" && (
              <ReplyEditor
                mode="create"
                categories={categories}
                defaultCategory={activeCategory === ALL ? undefined : activeCategory}
              />
            )}
          </div>
        </div>

        {categories.length > 1 && (
          <fieldset className="m-0 flex min-w-0 gap-2 overflow-x-auto border-0 p-0 pb-1">
            <legend className="sr-only">Категории ответов</legend>
            {[ALL, ...categories].map((item) => (
              <Button
                key={item}
                size="sm"
                variant={activeCategory === item ? "default" : "outline"}
                aria-pressed={activeCategory === item}
                className="shrink-0"
                onClick={() => setCategory(item)}
              >
                {item}
              </Button>
            ))}
          </fieldset>
        )}
      </section>

      {total > 0 ? (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.name} className="flex flex-col gap-3" aria-label={group.name}>
              <h2 className="flex items-center gap-2 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                {group.name}
                <span className="font-normal tabular-nums">{group.items.length}</span>
              </h2>
              <div className={cn("grid gap-3", layout === "columns" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                {group.items.map((reply) => (
                  <ReplyCard key={reply.id} reply={reply} categories={categories} editable={editor === "on"} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          {replies.length === 0
            ? "Быстрых ответов пока нет."
            : "Ничего не найдено. Измените запрос или выберите другую категорию."}
        </div>
      )}
    </main>
  );
}
