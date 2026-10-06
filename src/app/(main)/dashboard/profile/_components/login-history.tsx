"use client";

import { useState } from "react";

import { ChevronDown, History, Monitor } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export type LoginRow = { id: string; active: boolean; device: string; when: string; ip: string | null };

function Row({ row, active = false }: { row: LoginRow; active?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
      <span className="flex items-center gap-2 text-sm">
        <Monitor className="size-4 text-muted-foreground" />
        {row.device}
        {active && (
          <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
            Активная сессия
          </Badge>
        )}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {row.when}
        {row.ip ? ` · ${row.ip}` : ""}
      </span>
    </div>
  );
}

/** История входов: по умолчанию видна только активная сессия, остальные записи раскрываются кнопкой. */
export function LoginHistory({ rows }: { rows: LoginRow[] }) {
  const [open, setOpen] = useState(false);
  const current = rows.find((row) => row.active) ?? rows[0];
  const older = rows.filter((row) => row !== current);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="size-4" aria-hidden="true" />Последние входы</CardTitle>
        <CardDescription>Если здесь есть вход, которого вы не совершали, сообщите администратору.</CardDescription>
      </CardHeader>
      <CardContent>
        {!current && <p className="text-muted-foreground text-sm">Записей пока нет.</p>}
        {current && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <div className="flex flex-col divide-y">
              <Row row={current} active />
              <CollapsibleContent className="flex flex-col divide-y">
                {older.map((row) => (
                  <Row key={row.id} row={row} />
                ))}
              </CollapsibleContent>
            </div>
            {older.length > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="mt-3 -ml-2.5 text-muted-foreground">
                  <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
                  {open ? "Скрыть историю" : `Показать историю (${older.length})`}
                </Button>
              </CollapsibleTrigger>
            )}
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
