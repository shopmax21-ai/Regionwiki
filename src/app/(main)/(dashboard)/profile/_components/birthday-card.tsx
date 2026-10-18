"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";
import { Cake, Check, ChevronDown, Gift, PartyPopper, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  birthdayInYear,
  formatBirthday,
  MAX_DAYS,
  MONTHS,
  mskDateParts,
  parseBirthday,
  toBirthday,
} from "@/lib/birthdays/types";

import { saveBirthday } from "../_actions";

const DAY_MS = 86_400_000;

/** Сколько дней до ближайшего дня рождения по Москве: 0 — сегодня. */
function daysUntil(value: string): number | null {
  const today = mskDateParts();
  const parse = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const thisYear = birthdayInYear(value, today.year);
  const nextYear = birthdayInYear(value, today.year + 1);
  if (!thisYear || !nextYear) return null;
  const diff = Math.round((parse(thisYear) - parse(today.key)) / DAY_MS);
  return diff >= 0 ? diff : Math.round((parse(nextYear) - parse(today.key)) / DAY_MS);
}

function countdownText(days: number): string {
  if (days === 0) return "Сегодня ваш день!";
  if (days === 1) return "Уже завтра";
  const last = days % 10;
  const tens = days % 100;
  let word = "дней";
  if (tens < 11 || tens > 14) {
    if (last === 1) word = "день";
    else if (last >= 2 && last <= 4) word = "дня";
  }
  return `Через ${days} ${word}`;
}

type PickerProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  display: string;
  disabled: boolean;
  columns: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onSelect: (value: string) => void;
  className?: string;
};

/** Свой выпадающий выбор вместо системного: сетка вариантов в окне поверх страницы, в цветах сайта. */
function Picker({
  id,
  label,
  value,
  placeholder,
  display,
  disabled,
  columns,
  options,
  onSelect,
  className,
}: PickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-pink-500/25 bg-background/70 px-3 text-sm outline-none backdrop-blur transition",
              "hover:border-pink-500/50 hover:bg-pink-500/5 focus-visible:border-pink-500/60 focus-visible:ring-3 focus-visible:ring-pink-500/20",
              "disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-pink-500/60 data-[state=open]:ring-3 data-[state=open]:ring-pink-500/20",
            )}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? display : placeholder}</span>
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 gap-0 rounded-xl p-2">
          <div role="listbox" aria-label={label} className={cn("grid gap-1", columns)}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={option.disabled}
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex h-8 items-center justify-center rounded-lg px-1 text-sm tabular-nums outline-none transition-colors",
                    "hover:bg-pink-500/10 focus-visible:bg-pink-500/10 focus-visible:ring-2 focus-visible:ring-pink-500/40",
                    "disabled:pointer-events-none disabled:opacity-30",
                    active && "bg-pink-500 font-semibold text-white hover:bg-pink-500",
                  )}
                >
                  {option.label}
                  {active && columns.includes("grid-cols-2") && (
                    <Check className="absolute right-2 size-3.5" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** День рождения: день и месяц без года. В этот день сайт поздравит фейерверком, а коллеги получат напоминание накануне. */
export function BirthdayCard({ initial }: { initial: string | null }) {
  const router = useRouter();
  const parsed = parseBirthday(initial);
  const [month, setMonth] = useState(parsed ? String(parsed.month) : "");
  const [day, setDay] = useState(parsed ? String(parsed.day) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Сколько дней осталось, считаем в браузере: на сервере и у человека «сегодня» может отличаться
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    setLeft(initial && parseBirthday(initial) ? daysUntil(initial) : null);
  }, [initial]);

  const monthNumber = Number(month);
  const dayCount = monthNumber ? MAX_DAYS[monthNumber - 1] : 31;
  const value = month && day ? toBirthday(monthNumber, Number(day)) : null;
  const valid = value !== null && parseBirthday(value) !== null;
  const dirty = (value ?? "") !== (initial ?? "");
  const isToday = left === 0;

  const save = (next: string | null) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveBirthday(next);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (next === null) {
          setMonth("");
          setDay("");
        }
        toast.success(next === null ? "День рождения убран" : "День рождения сохранён");
        router.refresh();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <Card className="relative overflow-hidden border-pink-500/25 bg-linear-to-br from-pink-500/10 via-card to-amber-400/10">
      {/* Праздничный фон: мягкие пятна света и крупные значки в углах */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -right-12 size-52 rounded-full bg-pink-500/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-amber-400/15 blur-3xl" />
        <PartyPopper className="absolute top-4 right-5 size-16 rotate-12 text-pink-500/15" />
        <Gift className="absolute right-24 bottom-3 size-12 -rotate-12 text-amber-500/15" />
        <Sparkles className="absolute top-10 right-36 size-6 text-amber-500/30" />
      </div>

      <CardContent className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
        <div className="flex flex-col items-start gap-3 sm:w-56 sm:shrink-0">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-pink-500 to-rose-400 text-white shadow-lg shadow-pink-500/25">
            <Cake className="size-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-lg leading-tight">День рождения</h3>
            {initial ? (
              <>
                <p className="font-semibold text-2xl text-pink-600 tracking-tight dark:text-pink-400">
                  {formatBirthday(initial)}
                </p>
                {left !== null && (
                  <span
                    className={cn(
                      "mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
                      isToday
                        ? "border-amber-500/40 bg-amber-400/15 font-medium text-amber-700 dark:text-amber-300"
                        : "border-pink-500/25 bg-pink-500/10 text-pink-700 dark:text-pink-300",
                    )}
                  >
                    <Sparkles className="size-3" aria-hidden="true" />
                    {countdownText(left)}
                  </span>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Дата пока не указана</p>
            )}
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Год не нужен. Дата появится в календаре, коллеги получат напоминание в Telegram за день, а в сам день
            рождения сайт поздравит вас при первом входе.
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:max-w-sm">
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
            <Picker
              id="birthday-day"
              label="День"
              value={day}
              display={day}
              placeholder="—"
              disabled={pending}
              columns="grid-cols-7"
              options={Array.from({ length: dayCount }, (_, index) => ({
                value: String(index + 1),
                label: String(index + 1),
              }))}
              onSelect={(next) => {
                setError(null);
                setDay(next);
              }}
            />
            <Picker
              id="birthday-month"
              label="Месяц"
              value={month}
              display={month ? MONTHS[monthNumber - 1] : ""}
              placeholder="Выберите месяц"
              disabled={pending}
              columns="grid-cols-2"
              options={MONTHS.map((name, index) => ({ value: String(index + 1), label: name }))}
              onSelect={(next) => {
                setError(null);
                setMonth(next);
                // Если в новом месяце меньше дней, выбранный день сбрасываем
                if (next && Number(day) > MAX_DAYS[Number(next) - 1]) setDay("");
              }}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm"
            >
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => value && save(value)}
              disabled={pending || !valid || !dirty}
              className="bg-linear-to-r from-pink-500 to-rose-500 text-white hover:from-pink-500/90 hover:to-rose-500/90"
            >
              <Save data-icon="inline-start" />
              {pending ? "Сохранение..." : "Сохранить"}
            </Button>
            {initial && (
              <Button variant="ghost" onClick={() => save(null)} disabled={pending}>
                Убрать дату
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
