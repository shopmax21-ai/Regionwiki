import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { listAssigned, listClosedBy, listQueue } from "@/lib/punishments/store";
import type { PunishmentRequest, QueueItem } from "@/lib/punishments/types";

import { AutoRefresh } from "../_components/auto-refresh";
import { AssignedBlock } from "./_components/assigned-block";
import { ClosedTable } from "./_components/closed-table";
import { QueueList } from "./_components/queue-list";

export const metadata: Metadata = {
  title: "Рассмотрение наказаний | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Раздел администратора: очередь заявок хелперов, его заявки в работе и таблица выданных им наказаний. */
export default async function Page() {
  if (!getAuthConfig()) redirect("/dashboard");
  const admin = await getAdmin("punishments.review");
  if (!admin) redirect("/unauthorized");

  let queue: QueueItem[] = [];
  let assigned: PunishmentRequest[] = [];
  let closed: PunishmentRequest[] = [];
  let problem: string | null = null;
  try {
    // Блоки «в работе» запрашиваются только по id этого администратора: чужие заявки сюда не попадают
    [queue, assigned, closed] = await Promise.all([listQueue(), listAssigned(admin.id), listClosedBy(admin.id)]);
  } catch (error) {
    console.error("[punishments] Не удалось загрузить заявки", error);
    problem = "база данных недоступна";
  }

  const now = Date.now();
  const issued = closed.filter((request) => request.status === "issued").length;
  const tiles = [
    { title: "В очереди", value: queue.length, note: "ждут администратора" },
    { title: "В работе у меня", value: assigned.length, note: "взяты вами" },
    { title: "Выдано мной", value: issued, note: "закреплено за вами" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl">Рассмотрение наказаний</h1>
        <p className="text-muted-foreground text-sm">
          Заявки хелперов. Взятая в работу заявка видна только вам: команда для выдачи наказания и кнопки решения
          находятся в её блоке.
        </p>
      </div>

      {problem && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          Не удалось загрузить заявки: {problem}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.title}>
            <CardHeader>
              <CardTitle className="text-sm">{tile.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl tabular-nums tracking-tight">{tile.value}</span>
              <p className="text-muted-foreground text-xs">{tile.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3" aria-label="Заявки в работе у меня">
        <h2 className="font-semibold text-lg">В работе у меня</h2>
        {assigned.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
            У вас нет заявок в работе. Возьмите заявку из очереди ниже.
          </p>
        ) : (
          assigned.map((request) => <AssignedBlock key={request.id} request={request} now={now} />)
        )}
      </section>

      <QueueList items={queue} now={now} />
      <ClosedTable requests={closed} />
    </div>
  );
}
