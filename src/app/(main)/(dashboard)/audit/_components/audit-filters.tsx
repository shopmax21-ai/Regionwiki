"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { usePathname, useRouter } from "next/navigation";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIT_CATEGORIES, AUDIT_SEVERITIES, CATEGORY_LABELS, SEVERITY_LABELS } from "@/lib/audit/types";

export type AuditFilterValues = { category?: string; severity?: string; actor?: string; q?: string };

const ALL = "all";

/** Фильтры живут в адресе страницы: ссылкой на отфильтрованный журнал можно поделиться, «Назад» работает как ждёшь. */
export function AuditFilters({
  actors,
  current,
  total,
}: {
  actors: { id: string; name: string }[];
  current: AuditFilterValues;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(current.q ?? "");
  const lastPushed = useRef(current.q ?? "");

  const go = (next: AuditFilterValues) => {
    const query = new URLSearchParams();
    if (next.category) query.set("category", next.category);
    if (next.severity) query.set("severity", next.severity);
    if (next.actor) query.set("actor", next.actor);
    if (next.q) query.set("q", next.q);
    const suffix = query.toString();
    startTransition(() => router.push(suffix ? `${pathname}?${suffix}` : pathname));
  };

  // Поиск по тексту срабатывает после паузы в наборе, а не на каждую букву
  // biome-ignore lint/correctness/useExhaustiveDependencies: срабатывает только на ввод текста
  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = trimmed;
      go({ ...current, q: trimmed || undefined });
    }, 400);
    return () => clearTimeout(timer);
  }, [text]);

  const filtered = [current.category, current.severity, current.actor, current.q].some(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl leading-none">Аудит действий администрации</h1>
        <p className="text-muted-foreground text-sm">
          Журнал значимых изменений: доступ, группы и права, правки и удаление контента, решения по наказаниям. Записи
          нельзя изменить или удалить. Всего записей: {total}.
        </p>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center" aria-busy={pending}>
        <div className="relative lg:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Поиск по действию, объекту или имени"
            className="pl-9"
            maxLength={80}
            aria-label="Поиск по журналу"
          />
        </div>

        <Select
          value={current.category ?? ALL}
          onValueChange={(value) => go({ ...current, category: value === ALL ? undefined : value })}
        >
          <SelectTrigger className="w-full lg:w-44" aria-label="Раздел">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectItem value={ALL}>Все разделы</SelectItem>
              {AUDIT_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={current.severity ?? ALL}
          onValueChange={(value) => go({ ...current, severity: value === ALL ? undefined : value })}
        >
          <SelectTrigger className="w-full lg:w-40" aria-label="Важность">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectItem value={ALL}>Любая важность</SelectItem>
              {AUDIT_SEVERITIES.map((severity) => (
                <SelectItem key={severity} value={severity}>
                  {SEVERITY_LABELS[severity]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={current.actor ?? ALL}
          onValueChange={(value) => go({ ...current, actor: value === ALL ? undefined : value })}
        >
          <SelectTrigger className="w-full lg:w-52" aria-label="Кто сделал">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectItem value={ALL}>Все администраторы</SelectItem>
              {actors.map((actor) => (
                <SelectItem key={actor.id} value={actor.id}>
                  {actor.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setText("");
              lastPushed.current = "";
              go({});
            }}
          >
            <X data-icon="inline-start" />
            Сбросить
          </Button>
        )}
      </div>
    </div>
  );
}
