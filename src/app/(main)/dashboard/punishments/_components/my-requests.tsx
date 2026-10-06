import { Paperclip } from "lucide-react";

import { PersonName } from "@/components/person-name";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { personFromName } from "@/lib/auth/person";
import { kindText, type PunishmentRequest } from "@/lib/punishments/types";

import { durationLabel, formatFull, formatShort } from "./format";
import { HelperStatusBadge, RuleChips } from "./status-badge";

/** Таблица наказаний хелпера: его заявки и их статус. После выдачи наказания статус становится «Выдано». */
export function MyRequests({ requests }: { requests: PunishmentRequest[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Мои заявки</CardTitle>
        <CardDescription>Статус обновляется сам, перезагружать страницу не нужно.</CardDescription>
      </CardHeader>
      {requests.length === 0 ? (
        <p className="px-4 py-8 text-center text-muted-foreground text-sm">Вы ещё не подавали заявок.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">№</TableHead>
                <TableHead>Статик</TableHead>
                <TableHead>Наказание</TableHead>
                <TableHead>Срок</TableHead>
                <TableHead>Пункты</TableHead>
                <TableHead>Подана</TableHead>
                <TableHead className="pr-4">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="pl-4 text-muted-foreground tabular-nums">{request.number}</TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {request.staticId}
                    {request.evidence.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 font-normal text-muted-foreground text-xs">
                        <Paperclip className="size-3" aria-label="Есть доказательства" />
                        {request.evidence.length}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{kindText(request)}</TableCell>
                  <TableCell className="whitespace-nowrap">{durationLabel(request)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <RuleChips rules={request.rules} />
                      {request.forum && <span className="text-muted-foreground text-xs">Жалоба: {request.forum}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
                    {formatShort(request.createdAt)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex flex-col items-start gap-1">
                      <HelperStatusBadge status={request.status} />
                      {(request.status === "claimed" || request.status === "approved") && request.assigneeName && (
                        <span className="flex items-center gap-1 text-muted-foreground text-xs">
                          Рассматривает:{" "}
                          <PersonName person={request.assignee ?? personFromName(request.assigneeName)} />
                        </span>
                      )}
                      {request.status === "issued" && request.assigneeName && request.issuedAt && (
                        <span className="flex flex-wrap items-center gap-x-1 text-muted-foreground text-xs">
                          Выдал <PersonName person={request.assignee ?? personFromName(request.assigneeName)} />,{" "}
                          {formatFull(request.issuedAt)}
                        </span>
                      )}
                      {request.status === "rejected" && (
                        <span className="flex flex-wrap items-center gap-x-1 text-muted-foreground text-xs">
                          {request.assignee && (
                            <>
                              <PersonName person={request.assignee} />:
                            </>
                          )}
                          {request.decisionNote || "причина не указана"}
                        </span>
                      )}
                    </div>
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
