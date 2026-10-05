import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { countByStatus, listAll, listEvents } from "@/lib/punishments/store";
import type { PunishmentEvent, PunishmentRequest } from "@/lib/punishments/types";

import { AutoRefresh } from "../_components/auto-refresh";
import { AllPunishments } from "./_components/all-punishments";

export const metadata: Metadata = {
  title: "Все наказания | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Раздел Гл.Администратора: все наказания (на рассмотрении, выданные, отклонённые) и история всех действий. */
export default async function Page() {
  if (!getAuthConfig()) redirect("/dashboard");
  if (!(await getAdmin("punishments.all"))) redirect("/unauthorized");

  let requests: PunishmentRequest[] = [];
  let events: PunishmentEvent[] = [];
  let counts = { pending: 0, claimed: 0, approved: 0, issued: 0, rejected: 0 };
  let problem: string | null = null;
  try {
    [requests, events, counts] = await Promise.all([listAll(), listEvents(), countByStatus()]);
  } catch (error) {
    console.error("[punishments] Не удалось загрузить наказания", error);
    problem = "база данных недоступна";
  }

  const tiles = [
    {
      title: "На рассмотрении",
      value: counts.pending + counts.claimed + counts.approved,
      note: `${counts.pending} ждут администратора`,
    },
    { title: "Выдано", value: counts.issued, note: "наказаний за всё время" },
    { title: "Отклонено", value: counts.rejected, note: "заявок за всё время" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl">Все наказания</h1>
        <p className="text-muted-foreground text-sm">
          Заявки на рассмотрении, выданные и отклонённые наказания и история всех действий. Раздел виден только Главным
          администраторам.
        </p>
      </div>
      {problem && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          Не удалось загрузить данные: {problem}
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
      <AllPunishments requests={requests} events={events} />
    </div>
  );
}
