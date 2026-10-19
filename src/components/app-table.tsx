"use client"

import * as React from "react"
import { cn } from "cn"

import {
  Table as BaseTable,
  TableBody as BaseTableBody,
  TableCaption,
  TableCell as BaseTableCell,
  TableFooter,
  TableHead as BaseTableHead,
  TableHeader as BaseTableHeader,
  TableRow as BaseTableRow,
} from "@/components/ui/table"

/**
 * Единый стиль таблиц проекта. Все таблицы импортируют компоненты отсюда, а не из `ui/table`
 * (сам `ui/table` остаётся нетронутым, как требует AGENTS.md).
 *
 * Оформление живёт здесь и не дублируется в местах использования. Стиль «карточки-строки»:
 * - шапка без фона и линий: приглушённые подписи, жирнее обычного;
 * - каждая строка — отдельная скруглённая плашка, между строками зазор;
 * - при наведении плашка светлеет, баннер профиля поддерживается;
 * - крайние ячейки: одинаковый отступ 1rem слева и справа.
 *
 * В местах использования задают только min-w у таблицы, ширину столбцов и выравнивание (text-center / text-right).
 */

/** Цвет плашки строки и затухания баннера: чуть темнее/светлее карточки, в которой лежит таблица. */
const ROW_BG = "[--row-bg:color-mix(in_oklab,var(--card),var(--muted)_55%)]"
const ROW_BG_HOVER = "hover:[--row-bg:color-mix(in_oklab,var(--card),var(--muted)_90%)]"

function Table({ className, ...props }: React.ComponentProps<typeof BaseTable>) {
  return <BaseTable className={cn("border-separate border-spacing-y-1.5", className)} {...props} />
}

function TableHeader({ className, ...props }: React.ComponentProps<typeof BaseTableHeader>) {
  return (
    <BaseTableHeader
      className={cn("[&_tr]:border-0 [&_tr]:bg-transparent [&_tr]:hover:bg-transparent", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<typeof BaseTableBody>) {
  return <BaseTableBody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
}

function TableRow({ className, ...props }: React.ComponentProps<typeof BaseTableRow>) {
  return (
    <BaseTableRow
      className={cn(
        // Плашка: фон строки совпадает со слоем затухания баннера (--row-bg), поэтому баннер не «мигает» краями
        "border-0 bg-(--row-bg) transition-colors [clip-path:inset(0_round_0.75rem)]",
        ROW_BG,
        ROW_BG_HOVER,
        "hover:bg-(--row-bg)",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<typeof BaseTableHead>) {
  return (
    <BaseTableHead
      className={cn("h-9 px-3 font-semibold text-xs text-muted-foreground first:pl-4 last:pr-4", className)}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<typeof BaseTableCell>) {
  return <BaseTableCell className={cn("px-3 py-3.5 first:pl-4 last:pr-4", className)} {...props} />
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
