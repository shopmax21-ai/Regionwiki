import type { ReactNode } from "react";

import { requirePageAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/** Раздел только для администрации: остальных переносим на страницу «нет доступа». */
export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  await requirePageAdmin();
  return children;
}
