import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { hasPermission } from "@/lib/auth/admin";
import { listJobs } from "@/lib/jobs/store";

import { JobEditorPage } from "../_components/job-editor-page";

export const metadata: Metadata = {
  title: "Новая работа | Работы | Region WIKI",
};

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const [{ jobs, editable }, canEdit] = await Promise.all([listJobs(), hasPermission("jobs.edit")]);
  // Без права или без базы редактировать нечего: возвращаем к списку, где причина видна
  if (!canEdit || !editable) redirect("/dashboard/jobs");

  return <JobEditorPage mode="create" allJobs={jobs} />;
}
