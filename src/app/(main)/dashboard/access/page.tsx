import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAdmin } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { listUsers } from "@/lib/auth/db";

import { AccessList } from "./_components/access-list";

export const metadata: Metadata = {
  title: "Заявки на доступ | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!getAuthConfig()) redirect("/dashboard");

  const admin = await getAdmin("access.decide");
  if (!admin) redirect("/unauthorized");

  return <AccessList users={await listUsers()} />;
}
