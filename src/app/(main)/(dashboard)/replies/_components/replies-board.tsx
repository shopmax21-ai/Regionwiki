"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "cn";
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  CornerDownLeft,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Rows3,
  Search,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";

import type { QuickReply } from "../_data/replies";
import { categoryHue, hueStyle } from "./category-hue";
import { copyText } from "./copy-text";
import { ReplyCard } from "./reply-card";
import { ReplyEditor } from "./reply-editor";

type Layout = "rows" | "columns";

const LAYOUT_KEY = "region-replies-layout";
const RECENT_KEY = "region-replies-recent";
const FAVORITES_KEY = "region-replies-favorites";
const COLLAPSED_CATEGORIES_KEY = "region-replies-collapsed-categories";
const COLLAPSED_CARDS_KEY = "region-replies-collapsed-cards";
const FAVORITES_SECTION = "__favorites__";
const RECENT_LIMIT = 5;
const ALL = "Все";

/** Кнопка показывает вид, на который переключит нажатие. */
const nextLayout: Record<Layout, { id: Layout; label: string; icon: typeof Rows3 }> = {
  columns: { id: "rows", label: "Показать в строку", icon: Rows3 },
  rows: { id: "columns", label: "Показать колонками", icon: LayoutGrid },
};

const isLayout = (value: string | null): value is Layout => value === "rows" || value === "columns";

/** Список последних использованных ответов из браузера. Любой мусор в хранилище отбрасываем. */
function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(getLocalStorageValue(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string").slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

/** Список строк из браузера (избранное, свёрнутые категории и карточки). Любой мусор в хранилище отбрасываем. */
function readList(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(getLocalStorageValue(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** "on" — можно менять, "off" — только копировать, "unavailable" — права есть, но база не подключена. */
type EditorState = "on" | "off" | "unavailable";

/** Точка цвета категории. */
function Dot({ category, className }: { category: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={hueStyle(categoryHue(category))}
      className={cn("size-2.5 shrink-0 rounded-md bg-[oklch(0.68_0.16_var(--h))]", className)}
    />
  );
}

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
  const [recent, setRecent] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const [collapsedCards, setCollapsedCards] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Вид и недавние ответы запоминаются в браузере. Читаем после загрузки, чтобы не ломать серверную разметку.
  useEffect(() => {
    const saved = getLocalStorageValue(LAYOUT_KEY);
    if (isLayout(saved)) setLayout(saved);
    setRecent(readRecent());
    setFavorites(readList(FAVORITES_KEY));
    setCollapsedSections(readList(COLLAPSED_CATEGORIES_KEY));
    setCollapsedCards(readList(COLLAPSED_CARDS_KEY));
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Клавиша «/» переводит курсор в поиск, как на GitHub и в документациях
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleLayout = () => {
    const next = nextLayout[layout].id;
    setLayout(next);
    setLocalStorageValue(LAYOUT_KEY, next);
  };

  const toggleIn = (
    setter: (update: (prev: string[]) => string[]) => void,
    key: string,
    id: string,
  ) =>
    setter((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      setLocalStorageValue(key, JSON.stringify(next));
      return next;
    });

  const replaceList = (setter: (value: string[]) => void, key: string, next: string[]) => {
    setter(next);
    setLocalStorageValue(key, JSON.stringify(next));
  };

  const toggleFavorite = (reply: QuickReply) => toggleIn(setFavorites, FAVORITES_KEY, reply.id);
  const toggleCard = (reply: QuickReply) => toggleIn(setCollapsedCards, COLLAPSED_CARDS_KEY, reply.id);
  const toggleSection = (name: string) => toggleIn(setCollapsedSections, COLLAPSED_CATEGORIES_KEY, name);

  const copyReply = useCallback(async (reply: QuickReply) => {
    const ok = await copyText(reply.text);
    if (!ok) {
      toast.error("Не удалось скопировать, выделите текст вручную");
      return;
    }
    toast.success("Ответ скопирован");

    setCopiedId(reply.id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiedId(null), 1800);

    setRecent((prev) => {
      const next = [reply.id, ...prev.filter((id) => id !== reply.id)].slice(0, RECENT_LIMIT);
      setLocalStorageValue(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggle = nextLayout[layout];
  const ToggleIcon = toggle.icon;

  const categories = useMemo(() => Array.from(new Set(replies.map((reply) => reply.category))), [replies]);
  // Если выбранную категорию удалили вместе с последним ответом, возвращаемся ко всем
  const activeCategory = category === ALL || categories.includes(category) ? category : ALL;
  const normalized = query.trim().toLowerCase();

  const matchesQuery = useCallback(
    (reply: QuickReply) =>
      !normalized || `${reply.title} ${reply.text} ${reply.category}`.toLowerCase().includes(normalized),
    [normalized],
  );

  // Сколько ответов подходит под запрос в каждой категории: видно, где искать, не открывая их по очереди
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const reply of replies) {
      if (matchesQuery(reply)) map.set(reply.category, (map.get(reply.category) ?? 0) + 1);
    }
    return map;
  }, [replies, matchesQuery]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, QuickReply[]>();
    for (const reply of replies) {
      if (activeCategory !== ALL && reply.category !== activeCategory) continue;
      if (!matchesQuery(reply)) continue;
      const list = byCategory.get(reply.category);
      if (list) list.push(reply);
      else byCategory.set(reply.category, [reply]);
    }
    return Array.from(byCategory, ([name, items]) => ({ name, items }));
  }, [replies, activeCategory, matchesQuery]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const allCount = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);

  const recentReplies = useMemo(
    () => recent.map((id) => replies.find((reply) => reply.id === id)).filter((reply): reply is QuickReply => !!reply),
    [recent, replies],
  );

  const favoriteReplies = useMemo(
    () => replies.filter((reply) => favorites.includes(reply.id) && matchesQuery(reply)),
    [replies, favorites, matchesQuery],
  );

  const allCardsCollapsed = replies.length > 0 && replies.every((reply) => collapsedCards.includes(reply.id));
  const allSectionsCollapsed =
    categories.length > 0 && categories.every((name) => collapsedSections.includes(name));

  const toggleAllCards = () =>
    replaceList(setCollapsedCards, COLLAPSED_CARDS_KEY, allCardsCollapsed ? [] : replies.map((reply) => reply.id));
  const toggleAllSections = () =>
    replaceList(
      setCollapsedSections,
      COLLAPSED_CATEGORIES_KEY,
      allSectionsCollapsed ? [] : [...categories, FAVORITES_SECTION],
    );

  const chip = (name: string, count: number, hueFor?: string) => {
    const active = activeCategory === name;
    return (
      <button
        key={name}
        type="button"
        aria-pressed={active}
        onClick={() => setCategory(name)}
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-md border px-3.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
          active
            ? "border-foreground bg-foreground font-medium text-background"
            : "bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
          count === 0 && !active && "opacity-50",
        )}
      >
        {hueFor && <Dot category={hueFor} />}
        {name}
        <span className={cn("text-xs tabular-nums", active ? "text-background/70" : "text-muted-foreground")}>
          {count}
        </span>
      </button>
    );
  };

  const renderSection = ({
    key,
    title,
    marker,
    items,
  }: {
    key: string;
    title: string;
    marker: ReactNode;
    items: QuickReply[];
  }) => {
    // Во время поиска категории раскрыты: иначе найденное было бы спрятано
    const folded = !normalized && collapsedSections.includes(key);
    const bodyId = `replies-section-${key.replace(/\W/g, "_")}`;
    return (
      <section key={key} className="flex flex-col gap-3" aria-label={title}>
        <h2 className="font-semibold text-base">
          <button
            type="button"
            onClick={() => toggleSection(key)}
            aria-expanded={!folded}
            aria-controls={bodyId}
            disabled={!!normalized}
            className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted-foreground transition-transform", folded && "-rotate-90")}
              aria-hidden="true"
            />
            {marker}
            {title}
            <span className="font-normal text-muted-foreground text-sm tabular-nums">{items.length}</span>
          </button>
        </h2>
        {!folded && (
          <div
            id={bodyId}
            className={cn(
              "grid gap-4",
              layout === "columns" ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1",
            )}
          >
            {items.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                categories={categories}
                editable={editor === "on"}
                copied={copiedId === reply.id}
                onCopy={copyReply}
                query={query}
                favorite={favorites.includes(reply.id)}
                onToggleFavorite={toggleFavorite}
                collapsed={collapsedCards.includes(reply.id)}
                onToggleCollapsed={toggleCard}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-semibold text-3xl tracking-tight md:text-4xl">Быстрые ответы</h1>
        </div>
        {editor === "on" && (
          <ReplyEditor
            mode="create"
            categories={categories}
            defaultCategory={activeCategory === ALL ? undefined : activeCategory}
          />
        )}
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

      <section className="flex flex-col gap-3" aria-label="Поиск ответов">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && groups[0]?.items[0]) {
                  event.preventDefault();
                  void copyReply(groups[0].items[0]);
                }
                if (event.key === "Escape" && query) setQuery("");
              }}
              placeholder="Что нужно написать игроку?"
              aria-label="Поиск быстрых ответов" data-section-search
              className="h-12 rounded-xl pr-24 pl-12 text-base md:text-base"
            />
            <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
              {query ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Очистить поиск"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  <X />
                </Button>
              ) : (
                <Kbd className="max-sm:hidden">/</Kbd>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0 rounded-xl"
            onClick={toggleLayout}
            aria-label={toggle.label}
            title={toggle.label}
          >
            <ToggleIcon className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0 rounded-xl"
            onClick={toggleAllCards}
            aria-label={allCardsCollapsed ? "Развернуть все ответы" : "Свернуть все ответы до названий"}
            title={allCardsCollapsed ? "Развернуть все ответы" : "Свернуть все ответы до названий"}
          >
            {allCardsCollapsed ? (
              <Maximize2 className="size-4" aria-hidden="true" />
            ) : (
              <Minimize2 className="size-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0 rounded-xl"
            onClick={toggleAllSections}
            aria-label={allSectionsCollapsed ? "Развернуть все категории" : "Свернуть все категории"}
            title={allSectionsCollapsed ? "Развернуть все категории" : "Свернуть все категории"}
          >
            {allSectionsCollapsed ? (
              <ChevronsUpDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronsDownUp className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        {normalized && total > 0 && (
          <p className="flex items-center gap-1.5 text-muted-foreground text-xs max-sm:hidden">
            <Kbd>
              <CornerDownLeft />
            </Kbd>
            копирует первый найденный ответ
          </p>
        )}

        {categories.length > 1 && (
          <fieldset className="m-0 flex min-w-0 gap-2 overflow-x-auto border-0 p-0 pb-1">
            <legend className="sr-only">Категории ответов</legend>
            {chip(ALL, allCount)}
            {categories.map((name) => chip(name, counts.get(name) ?? 0, name))}
          </fieldset>
        )}
      </section>

      <div className="grid gap-8">
        <div className="flex min-w-0 flex-col gap-8">
          {!normalized && recentReplies.length > 0 && (
            <section className="flex flex-col gap-2.5" aria-label="Недавно использованные ответы">
              <h2 className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
                <Clock className="size-4" aria-hidden="true" /> Недавно использовали
              </h2>
              <div className="flex flex-wrap gap-2">
                {recentReplies.map((reply) => (
                  <button
                    key={reply.id}
                    type="button"
                    onClick={() => void copyReply(reply)}
                    title={reply.text}
                    style={hueStyle(categoryHue(reply.category))}
                    className={cn(
                      "flex max-w-full cursor-pointer items-center gap-2 rounded-md border bg-card py-1.5 pr-3.5 pl-3 text-sm outline-none transition-colors hover:border-[oklch(0.7_0.12_var(--h))] focus-visible:ring-3 focus-visible:ring-ring/50",
                      copiedId === reply.id &&
                        "border-[oklch(0.7_0.12_var(--h))] bg-[oklch(0.965_0.025_var(--h))] dark:bg-[oklch(0.28_0.045_var(--h))]",
                    )}
                  >
                    <Dot category={reply.category} />
                    <span className="truncate">{reply.title}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {total > 0 ? (
            <>
              {activeCategory === ALL && favoriteReplies.length > 0 && renderSection({
                key: FAVORITES_SECTION,
                title: "Избранное",
                marker: <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-hidden="true" />,
                items: favoriteReplies,
              })}
              {groups.map((group) =>
                renderSection({
                  key: group.name,
                  title: group.name,
                  marker: <Dot category={group.name} />,
                  items: group.items,
                }),
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              {replies.length === 0 ? (
                <p>Быстрых ответов пока нет.</p>
              ) : (
                <>
                  <p>
                    {normalized ? (
                      <>
                        По запросу «<span className="text-foreground">{query.trim()}</span>» ничего не нашлось.
                      </>
                    ) : (
                      "В этой категории ответов нет."
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setCategory(ALL);
                    }}
                  >
                    Показать все ответы
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
