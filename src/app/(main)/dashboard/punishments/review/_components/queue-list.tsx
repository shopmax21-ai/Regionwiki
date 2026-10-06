"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Paperclip } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { kindText, type QueueItem } from "@/lib/punishments/types";

import { claimRequestAction } from "../../_actions";
import { ago, durationLabel } from "../../_components/format";
import { RuleChips } from "../../_components/status-badge";

/**
 * Очередь свободных заявок: видна всем, кто рассматривает наказания. Доказательства отсюда не видны: после «Взять в
 * работу» заявка пропадает из очереди у всех и появляется блоком только у взявшего.
 */
export function QueueList({ items, now }: { items: QueueItem[]; now: number }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const claim = (item: QueueItem) => {
    setBusyId(item.id);
    startTransition(async () => {
      try {
        const result = await claimRequestAction(item.id);
        if (!result.ok) toast.error(result.error);
        else toast.success(`Заявка №${item.number} взята в работу`);
        router.refresh();
      } catch {
        toast.error("Нет связи с сервером, попробуйте ещё раз");
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Новые заявки</CardTitle>
        <CardDescription>
          Возьмите заявку в работу: она появится только у вас, у остальных администраторов исчезнет.
        </CardDescription>
      </CardHeader>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-muted-foreground text-sm">Новых заявок нет.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[780px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">№</TableHead>
                <TableHead>Хелпер</TableHead>
                <TableHead>Статик</TableHead>
                <TableHead>Наказание</TableHead>
                <TableHead>Срок</TableHead>
                <TableHead>Пункты</TableHead>
                <TableHead>Подана</TableHead>
                <TableHead className="pr-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-4 text-muted-foreground tabular-nums">{item.number}</TableCell>
                  <TableCell className="max-w-40 truncate">{item.requesterName}</TableCell>
                  <TableCell className="font-medium tabular-nums">{item.staticId}</TableCell>
                  <TableCell className="whitespace-nowrap">{kindText(item)}</TableCell>
                  <TableCell className="whitespace-nowrap">{durationLabel(item)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <RuleChips rules={item.rules} />
                      {item.forum && <span className="text-muted-foreground text-xs">Жалоба: {item.forum}</span>}
                      {item.evidenceCount > 0 ? (
                        <Badge variant="secondary">
                          <Paperclip data-icon="inline-start" />С доказательствами
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Без доказательств</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                    {ago(item.createdAt, now)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button size="sm" onClick={() => claim(item)} disabled={busyId !== null}>
                      {busyId === item.id ? "Берём..." : "Взять в работу"}
                    </Button>
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
