"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import {
  BirthdayCakeIcon,
  CaretDownIcon,
  CheckMarkIcon,
  ConfettiIcon,
  DayPickIcon,
  GiftBoxIcon,
  MonthPickIcon,
  SaveDiskIcon,
  SparkleIcon,
} from "@/components/icons/region-icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  icon: typeof DayPickIcon;
  options: { value: string; label: string }[];
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
  icon: Icon,
  options,
  onSelect,
  className,
}: PickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={label}
            title={label}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-xl border border-pink-500/25 bg-background/70 px-2.5 text-sm outline-none backdrop-blur transition",
              "hover:border-pink-500/50 hover:bg-pink-500/5 focus-visible:border-pink-500/60 focus-visible:ring-3 focus-visible:ring-pink-500/20",
              "disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-pink-500/60 data-[state=open]:ring-3 data-[state=open]:ring-pink-500/20",
            )}
          >
            <Icon className="size-4 shrink-0 text-pink-500" aria-hidden="true" />
            <span className={cn("flex-1 truncate text-left", !value && "text-muted-foreground")}>
              {value ? display : placeholder}
            </span>
            <CaretDownIcon
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
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex h-8 items-center justify-center rounded-lg px-1 text-sm tabular-nums outline-none transition-colors",
                    "hover:bg-pink-500/10 focus-visible:bg-pink-500/10 focus-visible:ring-2 focus-visible:ring-pink-500/40",
                    active && "bg-pink-500 font-semibold text-white hover:bg-pink-500",
                  )}
                >
                  {option.label}
                  {active && columns.includes("grid-cols-2") && (
                    <CheckMarkIcon className="absolute right-2 size-3.5" aria-hidden="true" />
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Дату указывают один раз: когда она уже есть, выбор и кнопки не показываются
  const locked = parseBirthday(initial) !== null;
  // Сколько дней осталось, считаем в браузере: на сервере и у человека «сегодня» может отличаться
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    setLeft(initial && parseBirthday(initial) ? daysUntil(initial) : null);
  }, [initial]);

  const monthNumber = Number(month);
  const dayCount = monthNumber ? MAX_DAYS[monthNumber - 1] : 31;
  const value = month && day ? toBirthday(monthNumber, Number(day)) : null;
  const valid = value !== null && parseBirthday(value) !== null;
  const isToday = left === 0;

  const save = (next: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveBirthday(next);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success("День рождения сохранён");
        router.refresh();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  return (
    <Card className="relative gap-0 overflow-hidden border-pink-500/25 bg-linear-to-br from-pink-500/10 via-card to-amber-400/10 py-0">
      {/* Праздничный фон: мягкие пятна света и значки в углах */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-12 -right-10 size-36 rounded-full bg-pink-500/15 blur-3xl" />
        <div className="absolute -bottom-14 -left-8 size-40 rounded-full bg-amber-400/15 blur-3xl" />
        <ConfettiIcon className="absolute top-2 right-3 size-9 rotate-12 text-pink-500/25" />
        <GiftBoxIcon className="absolute right-16 bottom-2 size-8 -rotate-12 text-amber-500/20" />
      </div>

      <CardContent className="relative flex flex-col gap-3 px-4 py-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-pink-500 to-rose-400 text-white shadow-md shadow-pink-500/25">
              <BirthdayCakeIcon className="size-5.5" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col">
              <h3 className="font-semibold leading-tight">День рождения</h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-muted-foreground text-sm">
                  {initial ? formatBirthday(initial) : "Дата пока не указана"}
                </span>
                {left !== null && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-px text-[11px]",
                      isToday
                        ? "border-amber-500/40 bg-amber-400/15 font-medium text-amber-700 dark:text-amber-300"
                        : "border-pink-500/25 bg-pink-500/10 text-pink-700 dark:text-pink-300",
                    )}
                  >
                    <SparkleIcon className="size-3" aria-hidden="true" />
                    {countdownText(left)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {locked ? (
            <span className="flex items-center gap-1.5 text-muted-foreground text-xs sm:mr-14">
              <Lock className="size-3.5" aria-hidden="true" />
              Указана, изменить нельзя
            </span>
          ) : (
            <div className="flex items-center gap-2 sm:mr-14">
              <Picker
                id="birthday-day"
                label="День"
                value={day}
                display={day}
                placeholder="День"
                disabled={pending}
                columns="grid-cols-7"
                icon={DayPickIcon}
                options={Array.from({ length: dayCount }, (_, index) => ({
                  value: String(index + 1),
                  label: String(index + 1),
                }))}
                onSelect={(next) => {
                  setError(null);
                  setDay(next);
                }}
                className="w-24"
              />
              <Picker
                id="birthday-month"
                label="Месяц"
                value={month}
                display={month ? MONTHS[monthNumber - 1] : ""}
                placeholder="Месяц"
                disabled={pending}
                columns="grid-cols-2"
                icon={MonthPickIcon}
                options={MONTHS.map((name, index) => ({ value: String(index + 1), label: name }))}
                onSelect={(next) => {
                  setError(null);
                  setMonth(next);
                  // Если в новом месяце меньше дней, выбранный день сбрасываем
                  if (next && Number(day) > MAX_DAYS[Number(next) - 1]) setDay("");
                }}
                className="w-36"
              />
              <Button
                size="icon"
                onClick={() => setConfirmOpen(true)}
                disabled={pending || !valid}
                aria-label="Сохранить"
                title={pending ? "Сохранение..." : "Сохранить"}
                className="size-9 shrink-0 rounded-xl bg-linear-to-br from-pink-500 to-rose-500 text-white hover:from-pink-500/90 hover:to-rose-500/90"
              >
                <SaveDiskIcon className="size-5" />
              </Button>
            </div>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-destructive text-sm"
          >
            {error}
          </p>
        )}

        <p className="max-w-2xl text-muted-foreground text-xs leading-relaxed">
          Год не нужен. Дата появится в календаре, коллеги получат напоминание в Telegram за день, а в сам день рождения
          сайт поздравит вас при первом входе. {locked ? "Дата указана один раз и дальше не меняется." : "Дату можно указать только один раз, поэтому проверьте её перед сохранением."}
        </p>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Сохранить день рождения?</AlertDialogTitle>
              <AlertDialogDescription>
                {value && valid ? formatBirthday(value) : ""}. Дату можно указать только один раз: потом изменить или
                убрать её нельзя.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Проверить ещё раз</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (value && valid) save(value);
                }}
              >
                Сохранить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
