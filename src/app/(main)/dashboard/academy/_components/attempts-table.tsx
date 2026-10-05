import Link from "next/link";

import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/academy/format";
import type { AttemptSummary } from "@/lib/academy/types";

export function PassBadge({ passed }: { passed: boolean }) {
  return passed ? (
    <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
      Сдан
    </Badge>
  ) : (
    <Badge variant="destructive">Не сдан</Badge>
  );
}

type AttemptsTableProps = {
  attempts: AttemptSummary[];
  /** Показывать ли колонку «Администратор» (в личном блоке она не нужна) */
  showUser?: boolean;
  /** Если задано, строка ведёт на разбор попытки */
  detailsHref?: (attempt: AttemptSummary) => string;
  emptyText: string;
};

/** Таблица попыток: только итог (баллы, процент, сдан или нет), без правильных ответов. */
export function AttemptsTable({ attempts, showUser = false, detailsHref, emptyText }: AttemptsTableProps) {
  if (attempts.length === 0) {
    return <p className="px-4 py-6 text-center text-muted-foreground text-sm">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Тест</TableHead>
            {showUser && <TableHead>Администратор</TableHead>}
            <TableHead>Завершён</TableHead>
            <TableHead className="text-right">Результат</TableHead>
            <TableHead className="text-center">Итог</TableHead>
            {detailsHref && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {attempts.map((attempt) => (
            <TableRow key={attempt.id}>
              <TableCell className="max-w-64 truncate pl-4 font-medium">{attempt.testTitle}</TableCell>
              {showUser && <TableCell className="max-w-48 truncate">{attempt.userName}</TableCell>}
              <TableCell className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
                {formatDateTime(attempt.finishedAt)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {attempt.score} из {attempt.total} · {attempt.percent}%
              </TableCell>
              <TableCell className="text-center">
                <PassBadge passed={attempt.passed} />
              </TableCell>
              {detailsHref && (
                <TableCell>
                  <Link
                    href={detailsHref(attempt)}
                    prefetch={false}
                    aria-label={`Разбор: ${attempt.testTitle}, ${attempt.userName}`}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
