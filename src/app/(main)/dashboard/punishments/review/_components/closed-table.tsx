import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PunishmentRequest } from "@/lib/punishments/types";

import { formatFull, minutesText } from "../../_components/format";
import { AdminStatusBadge, RuleChips } from "../../_components/status-badge";

/** Таблица выданных наказаний администратора: выданные им и отклонённые им заявки. */
export function ClosedTable({ requests }: { requests: PunishmentRequest[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Выданные наказания</CardTitle>
        <CardDescription>Наказания, закреплённые за вами, и заявки, которые вы отклонили.</CardDescription>
      </CardHeader>
      {requests.length === 0 ? (
        <p className="px-4 py-8 text-center text-muted-foreground text-sm">Выданных наказаний пока нет.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">№</TableHead>
                <TableHead>Статик</TableHead>
                <TableHead>Время</TableHead>
                <TableHead>Пункты</TableHead>
                <TableHead>Хелпер</TableHead>
                <TableHead>Итог</TableHead>
                <TableHead className="pr-4">Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="pl-4 text-muted-foreground tabular-nums">{request.number}</TableCell>
                  <TableCell className="font-medium tabular-nums">{request.staticId}</TableCell>
                  <TableCell className="whitespace-nowrap">{minutesText(request.minutes)}</TableCell>
                  <TableCell>
                    <RuleChips rules={request.rules} />
                  </TableCell>
                  <TableCell className="max-w-40 truncate">{request.requesterName}</TableCell>
                  <TableCell>
                    <AdminStatusBadge status={request.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap pr-4 text-muted-foreground text-xs tabular-nums">
                    {formatFull(request.issuedAt ?? request.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
