import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth/admin";
import { listCommands } from "@/lib/commands/store";

import { CommandsTable } from "./_components/commands-table";

export const metadata: Metadata = {
  title: "Команды сервера | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const admin = await requireAdmin();
  const { commands, editable, problem } = await listCommands();

  let editor: "on" | "off" | "unavailable" = "off";
  if (admin.permissions.includes("commands.edit")) editor = editable ? "on" : "unavailable";

  return <CommandsTable commands={commands} editor={editor} problem={problem} />;
}
