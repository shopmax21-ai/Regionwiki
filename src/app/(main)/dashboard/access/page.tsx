import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAuthConfig, SESSION_COOKIE } from "@/lib/auth/config";
import { getUser, listUsers } from "@/lib/auth/db";
import { readSessionToken } from "@/lib/auth/session";

import { AccessList } from "./_components/access-list";

export const metadata: Metadata = {
  title: "Заявки на доступ | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const config = getAuthConfig();
  if (!config) redirect("/dashboard");

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token, config.secret) : null;
  const admin = session ? await getUser(session.id) : null;
  if (!admin || admin.role !== "admin" || admin.status !== "approved") redirect("/unauthorized");

  return <AccessList users={await listUsers()} />;
}
