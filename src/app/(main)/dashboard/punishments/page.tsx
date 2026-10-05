import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { listMine } from "@/lib/punishments/store";
import type { PunishmentRequest } from "@/lib/punishments/types";

import { AutoRefresh } from "./_components/auto-refresh";
import { MyRequests } from "./_components/my-requests";
import { RequestForm } from "./_components/request-form";

export const metadata: Metadata = {
  title: "Заявка на наказание | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Раздел хелпера: подать заявку на наказание и следить за её статусом. */
export default async function Page() {
  if (!getAuthConfig()) redirect("/dashboard");
  const user = await getAdmin("punishments.request");
  if (!user) redirect("/unauthorized");

  let requests: PunishmentRequest[] = [];
  let problem: string | null = null;
  try {
    requests = await listMine(user.id);
  } catch (error) {
    console.error("[punishments] Не удалось загрузить заявки", error);
    problem = "база данных недоступна";
  }

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl">Заявка на наказание</h1>
        <p className="text-muted-foreground text-sm">
          Заполните данные нарушителя. Администратор рассмотрит заявку и выдаст наказание.
        </p>
      </div>
      {problem && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          Не удалось загрузить заявки: {problem}
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <RequestForm />
        <MyRequests requests={requests} />
      </div>
    </div>
  );
}
