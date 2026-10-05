"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PUNISHMENT_LIMITS, type RulePointHit } from "@/lib/punishments/types";
import { normalizeRuleLabel } from "@/lib/punishments/validate";

import { searchRulesAction } from "../_actions";

type RulePickerProps = {
  value: string[];
  onChange: (rules: string[]) => void;
  invalid?: boolean;
  disabled?: boolean;
};

/**
 * Выбор пунктов правил: начните вводить номер («оп 4.9») или слова из текста правила, подсказки приходят из актуального
 * текста правил. Если нужного пункта нет в подсказках, его можно записать вручную в виде «ОП 4.9» и нажать Enter.
 */
export function RulePicker({ value, onChange, invalid = false, disabled = false }: RulePickerProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<RulePointHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestSeq = useRef(0);

  // Поиск с задержкой: не шлём запрос на каждую букву, а устаревшие ответы отбрасываем
  useEffect(() => {
    const text = query.trim();
    if (text.length === 0) {
      setHits([]);
      setLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const result = await searchRulesAction(text).catch(() => []);
      if (seq !== requestSeq.current) return;
      setHits(result);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const full = value.length >= PUNISHMENT_LIMITS.maxRules;

  const add = (label: string) => {
    if (value.includes(label)) {
      setMessage(`Пункт ${label} уже добавлен`);
      return;
    }
    if (full) {
      setMessage(`Не больше ${PUNISHMENT_LIMITS.maxRules} пунктов`);
      return;
    }
    setMessage(null);
    onChange([...value, label]);
    setQuery("");
    setHits([]);
  };

  const submitTyped = () => {
    const typed = normalizeRuleLabel(query);
    if (typed) return add(typed);
    // Не похоже на «ОП 4.9»: берём первую подсказку, если она одна-единственная
    if (hits.length > 0 && query.trim()) return add(hits[0].label);
    setMessage("Запишите пункт как «ОП 4.9» или выберите из подсказок");
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((rule) => (
            <Badge key={rule} variant="secondary" className="gap-1 pr-0.5 font-mono">
              {rule}
              <button
                type="button"
                aria-label={`Убрать пункт ${rule}`}
                disabled={disabled}
                className="rounded-sm p-0.5 text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onChange(value.filter((item) => item !== rule))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Input
        id={inputId}
        value={query}
        disabled={disabled ? true : full}
        aria-invalid={invalid}
        autoComplete="off"
        placeholder={full ? "Достигнут предел пунктов" : "Номер пункта или слова из правила: ОП 4.9"}
        onChange={(event) => {
          setMessage(null);
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // Enter добавляет пункт и не отправляет форму
            event.preventDefault();
            submitTyped();
          }
        }}
      />

      {message && (
        <p role="alert" className="text-destructive text-xs">
          {message}
        </p>
      )}

      {query.trim() !== "" && (
        <div className="max-h-56 overflow-y-auto rounded-lg border">
          {loading && hits.length === 0 && (
            <p className="px-3 py-2 text-muted-foreground text-xs">Ищем в правилах...</p>
          )}
          {!loading && hits.length === 0 && (
            <p className="px-3 py-2 text-muted-foreground text-xs">
              Ничего не найдено. Если знаете номер, запишите его как «ОП 4.9» и нажмите Enter.
            </p>
          )}
          <ul>
            {hits.map((hit) => {
              const chosen = value.includes(hit.label);
              return (
                <li key={hit.label} className="border-b last:border-b-0">
                  <button
                    type="button"
                    disabled={chosen}
                    onClick={() => add(hit.label)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted disabled:opacity-50"
                  >
                    <Plus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium font-mono text-sm">{hit.label}</span>
                      <span className="text-muted-foreground text-xs leading-5">{hit.text}</span>
                      {hit.punishments.length > 0 && (
                        <span className="text-xs">Наказание: {hit.punishments.join(" / ")}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
