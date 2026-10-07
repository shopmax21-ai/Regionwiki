import type { Metadata } from "next";

import { JobsHub } from "@/app/(main)/(dashboard)/jobs/_components/jobs-hub";
import { hasPermission } from "@/lib/auth/admin";
import { listJobs } from "@/lib/jobs/store";

import type { JobEditorState } from "./_data/jobs";

export const metadata: Metadata = {
  title: "Всё о работах | Region WIKI",
  description: "Гайды по всем работам штата: условия доступа, процесс, советы и путь прокачки.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ jobs, editable, problem }, canEdit] = await Promise.all([listJobs(), hasPermission("jobs.edit")]);
  const editor: JobEditorState = !canEdit ? "off" : editable ? "on" : "unavailable";

  return <JobsHub jobs={jobs} editor={editor} problem={canEdit ? problem : null} />;
}
