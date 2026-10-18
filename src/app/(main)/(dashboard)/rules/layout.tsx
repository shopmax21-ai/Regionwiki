import type { ReactNode } from "react";

import { getPageAdminContext } from "@/lib/auth/admin";

import { RulesAdminProvider } from "./_components/rules-admin-context";

/** Один раз на раздел правил выясняет, может ли посетитель принудительно обновлять правила (только Гл.Администратор). */
export default async function RulesLayout({ children }: { children: ReactNode }) {
  const admin = await getPageAdminContext();
  return <RulesAdminProvider canRefresh={admin?.group === "chief"}>{children}</RulesAdminProvider>;
}
