import { PersonName } from "@/components/person-name";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PunishmentRequest } from "@/lib/punishments/types";

import { durationLabel, formatFull } from "../../_components/format";
import { AdminStatusBadge, PunishmentKindBadge, RuleChips } from "../../_components/status-badge";

/** Таблица выданных наказаний администратора: выданные им и отклонённые им заявки. */
export function ClosedTable({ requests }: { requests: PunishmentRequest[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Выданные наказания</h2>
      <div className="min-w-0">
        {requests.length === 0 ? (
          <p className="px-4 py-8 text-center text-muted-foreground text-sm">Выданных наказаний пока нет.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[740px] border-separate border-spacing-y-2">
              <TableHeader className="[&_tr]:border-0 [&_tr>th]:bg-muted [&_tr>th:first-child]:rounded-l-lg [&_tr>th:last-child]:rounded-r-lg">
                <TableRow>
                  <TableHead className="pl-4">Статик</TableHead>
                  <TableHead>Наказание</TableHead>
                  <TableHead>Срок</TableHead>
                  <TableHead>Пункты</TableHead>
                  <TableHead>Хелпер</TableHead>
                  <TableHead className="text-center">Итог</TableHead>
                  <TableHead className="pr-4">Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr]:border-0 [&_tr>td]:bg-card/80 [&_tr>td:first-child]:rounded-l-lg [&_tr>td:last-child]:rounded-r-lg">
                {requests.map((request) => (
                  <TableRow key={request.id} banner={request.requester.background}>
                    <TableCell className="font-medium font-mono tabular-nums">{request.staticId}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <PunishmentKindBadge kind={request.kind} muteChannel={request.muteChannel} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{durationLabel(request)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <RuleChips rules={request.rules} />
                        {request.forum && <span className="text-muted-foreground text-xs">Жалоба: {request.forum}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56">
                      <PersonName person={request.requester} avatar />
                    </TableCell>
                    <TableCell className="text-center">
                      <AdminStatusBadge status={request.status} compact />
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
      </div>
    </section>
  );
}
