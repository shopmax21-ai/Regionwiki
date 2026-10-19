"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";
import { Lock, Pencil, X } from "lucide-react";
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

import { saveBirthday, saveStaffBirthday } from "../_actions";

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
export function BirthdayCard({
  initial,
  targetId,
  canEdit = false,
}: {
  initial: string | null;
  /** Telegram ID администратора, чей это блок. Нужен только Гл.Администратору, который меняет чужую дату */
  targetId?: string;
  /** Гл.Администратор: может менять уже указанную дату */
  canEdit?: boolean;
}) {
  const router = useRouter();
  const parsed = parseBirthday(initial);
  const [month, setMonth] = useState(parsed ? String(parsed.month) : "");
  const [day, setDay] = useState(parsed ? String(parsed.day) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
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

  // Выбор даты виден, пока она не указана, и Гл.Администратору в режиме правки
  const picking = !locked || editing;

  const save = (next: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = locked && targetId !== undefined ? await saveStaffBirthday(targetId, next) : await saveBirthday(next);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setEditing(false);
        toast.success("День рождения сохранён");
        router.refresh();
      } catch {
        setError("Нет связи с сервером, попробуйте ещё раз");
      }
    });
  };

  // Лист календаря слева повторяет выбранную или сохранённую дату: так видно, что получится
  const shownMonth = !picking ? parsed?.month : monthNumber || null;
  const shownDay = !picking ? parsed?.day : Number(day) || null;
  const progress = left === null ? null : Math.min(1, Math.max(0, 1 - left / 365));

  return (
    <Card className="relative gap-0 overflow-hidden border-pink-500/25 bg-linear-to-br from-pink-500/10 via-card to-amber-400/10 py-0">
      {/* Праздничный фон: мягкие пятна света и значки в углах */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -right-12 size-44 rounded-full bg-pink-500/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 size-44 rounded-full bg-amber-400/15 blur-3xl" />
        <ConfettiIcon className="absolute top-3 right-4 size-10 rotate-12 text-pink-500/25" />
        <GiftBoxIcon className="absolute right-6 bottom-3 size-9 -rotate-12 text-amber-500/20" />
      </div>

      <CardContent className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6">
        {/* Лист календаря */}
        <div
          aria-hidden="true"
          className={cn(
            "flex w-24 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card text-center shadow-lg",
            isToday ? "border-amber-400/60 shadow-amber-500/20" : "border-pink-500/30 shadow-pink-500/15",
          )}
        >
          <span
            className={cn(
              "px-2 py-1 font-bold text-[11px] text-white uppercase tracking-widest",
              isToday ? "bg-linear-to-r from-amber-400 to-orange-400" : "bg-linear-to-r from-pink-500 to-rose-500",
            )}
          >
            {shownMonth ? MONTHS[shownMonth - 1].slice(0, 3) : "—"}
          </span>
          <span className="py-2 font-extrabold text-4xl text-foreground italic tabular-nums leading-none">
            {shownDay ?? "?"}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="flex items-center gap-2 font-semibold text-lg leading-tight">
              <BirthdayCakeIcon className="size-5 text-pink-500" aria-hidden="true" />
              День рождения
              {locked && !canEdit && (
                <Lock
                  className="size-3.5 text-muted-foreground"
                  aria-label="Дата указана, изменить её может Гл.Администратор"
                >
                  <title>Дата указана, изменить её может Гл.Администратор</title>
                </Lock>
              )}
              {locked && canEdit && !editing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground"
                  title="Изменить дату"
                  aria-label="Изменить дату"
                  onClick={() => {
                    setMonth(parsed ? String(parsed.month) : "");
                    setDay(parsed ? String(parsed.day) : "");
                    setEditing(true);
                  }}
                >
                  <Pencil />
                </Button>
              )}
            </h3>
            {locked && !editing && (
              <p className="text-muted-foreground text-sm">
                {initial ? formatBirthday(initial) : ""}
                {left !== null && (
                  <>
                    {" · "}
                    <span className={cn("font-medium", isToday ? "text-amber-600 dark:text-amber-300" : "text-pink-600 dark:text-pink-300")}>
                      {countdownText(left)}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>

          {!picking ? (
            progress !== null && (
              <div
                role="progressbar"
                aria-label="До следующего дня рождения"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-pink-500/15"
              >
                <div
                  className="h-full rounded-full bg-linear-to-r from-pink-500 to-amber-400"
                  style={{ width: `${Math.max(3, progress * 100)}%` }}
                />
              </div>
            )
          ) : (
            <div className="flex flex-wrap items-center gap-2">
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
                className="w-28"
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
                className="w-40"
              />
              <Button
                onClick={() => (locked ? value && save(value) : setConfirmOpen(true))}
                disabled={pending || !valid || (locked && value === initial)}
                className="h-9 rounded-xl bg-linear-to-br from-pink-500 to-rose-500 px-4 text-white hover:from-pink-500/90 hover:to-rose-500/90"
              >
                <SaveDiskIcon className="size-4" />
                {pending ? "Сохранение..." : "Сохранить"}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-xl text-muted-foreground"
                  title="Отмена"
                  aria-label="Отмена"
                  disabled={pending}
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                >
                  <X />
                </Button>
              )}
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-destructive text-sm"
            >
              {error}
            </p>
          )}
        </div>
      </CardContent>

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
    </Card>
  );
}
