import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { countAudit, listAudit, listAuditActors } from "@/lib/audit/store";
import { type AuditCategory, type AuditSeverity, isAuditCategory, isAuditSeverity, PAGE_SIZE } from "@/lib/audit/types";
import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";

import { AuditFilters } from "./_components/audit-filters";
import { AuditList } from "./_components/audit-list";

export const metadata: Metadata = {
  title: "Аудит действий | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  category?: string | string[];
  severity?: string | string[];
  actor?: string | string[];
  q?: string | string[];
  before?: string | string[];
}>;

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Раздел только для Гл.Администратора: журнал значимых изменений, которые вносила администрация. */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  if (!getAuthConfig()) redirect("/dashboard");
  if (!(await getAdmin("audit.view"))) redirect("/unauthorized");

  const params = await searchParams;
  const rawCategory = single(params.category);
  const rawSeverity = single(params.severity);
  const category: AuditCategory | undefined = isAuditCategory(rawCategory) ? rawCategory : undefined;
  const severity: AuditSeverity | undefined = isAuditSeverity(rawSeverity) ? rawSeverity : undefined;
  const actorId = single(params.actor)?.slice(0, 40) || undefined;
  const query = single(params.q)?.trim().slice(0, 80) || undefined;
  const before = single(params.before)?.slice(0, 20) || undefined;

  try {
    const [page, actors, total] = await Promise.all([
      listAudit({ category, severity, actorId, query, before, limit: PAGE_SIZE }),
      listAuditActors(),
      countAudit(),
    ]);

    return (
      <div className="flex flex-col gap-6">
        <AuditFilters actors={actors} current={{ category, severity, actor: actorId, q: query }} total={total} />
        <AuditList
          entries={page.entries}
          nextBefore={page.nextBefore}
          filters={{ category, severity, actor: actorId, q: query }}
          continued={before !== undefined}
        />
      </div>
    );
  } catch (error) {
    console.error("[audit] Не удалось загрузить журнал", error);
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        База данных недоступна. Журнал появится, когда подключение восстановится.
      </div>
    );
  }
}
