"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Cake, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatBirthday, MAX_DAYS, MONTHS, parseBirthday, toBirthday } from "@/lib/birthdays/types";

import { saveBirthday } from "../_actions";

/** День рождения: день и месяц без года. В этот день сайт поздравит фейерверком, а коллеги получат напоминание накануне. */
export function BirthdayCard({ initial }: { initial: string | null }) {
  const router = useRouter();
  const parsed = parseBirthday(initial);
  const [month, setMonth] = useState(parsed ? String(parsed.month) : "");
  const [day, setDay] = useState(parsed ? String(parsed.day) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const monthNumber = Number(month);
  const dayCount = monthNumber ? MAX_DAYS[monthNumber - 1] : 31;
  const value = month && day ? toBirthday(monthNumber, Number(day)) : null;
  const valid = value !== null && parseBirthday(value) !== null;
  const dirty = (value ?? "") !== (initial ?? "");

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cake className="size-5 text-pink-500" aria-hidden="true" /> День рождения
        </CardTitle>
        <CardDescription>
          Год не нужен. Дата появится в календаре, коллеги получат напоминание в Telegram за день, а в сам день рождения
          сайт поздравит вас при первом входе.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 sm:max-w-sm">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="birthday-day">День</Label>
            <NativeSelect
              id="birthday-day"
              className="w-full"
              value={day}
              disabled={pending}
              onChange={(event) => {
                setError(null);
                setDay(event.target.value);
              }}
            >
              <option value="">—</option>
              {Array.from({ length: dayCount }, (_, index) => index + 1).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="birthday-month">Месяц</Label>
            <NativeSelect
              id="birthday-month"
              className="w-full"
              value={month}
              disabled={pending}
              onChange={(event) => {
                setError(null);
                const nextMonth = event.target.value;
                setMonth(nextMonth);
                // Если в новом месяце меньше дней, выбранный день сбрасываем
                if (nextMonth && Number(day) > MAX_DAYS[Number(nextMonth) - 1]) setDay("");
              }}
            >
              <option value="">—</option>
              {MONTHS.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </div>
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
          <Button onClick={() => value && save(value)} disabled={pending || !valid || !dirty}>
            <Save data-icon="inline-start" />
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
          {initial && (
            <Button variant="ghost" onClick={() => save(null)} disabled={pending}>
              Убрать дату
            </Button>
          )}
          {initial && <span className="text-muted-foreground text-sm">Сейчас указано: {formatBirthday(initial)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
