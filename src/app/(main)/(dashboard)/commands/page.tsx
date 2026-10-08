import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth/admin";

import { CommandsTable } from "./_components/commands-table";
import { serverCommands } from "./_data/commands";

export const metadata: Metadata = {
  title: "Команды сервера | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin();
  return <CommandsTable commands={serverCommands} />;
}
