import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getAdminContext } from "@/lib/auth/admin";
import { getAuthConfig } from "@/lib/auth/config";
import { listReplies } from "@/lib/replies/store";

import { RepliesBoard } from "./_components/replies-board";

export const metadata: Metadata = {
  title: "Быстрые ответы | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  // Без настроенной авторизации раздел закрыть нечем, поэтому он недоступен
  if (!getAuthConfig()) redirect("/");

  const admin = await getAdminContext();
  if (!admin?.permissions.includes("replies.view")) redirect("/unauthorized");

  const { replies, editable, problem } = await listReplies();
  const canEdit = admin.permissions.includes("replies.edit");
  let editor: "on" | "off" | "unavailable" = "off";
  if (canEdit) editor = editable ? "on" : "unavailable";

  return <RepliesBoard replies={replies} editor={editor} problem={problem} />;
}
