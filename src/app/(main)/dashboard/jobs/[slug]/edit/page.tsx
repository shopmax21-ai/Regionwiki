import { notFound, redirect } from "next/navigation";

import type { Metadata } from "next";

import { hasPermission } from "@/lib/auth/admin";
import { listJobs } from "@/lib/jobs/store";

import { JobEditorPage } from "../../_components/job-editor-page";

export const metadata: Metadata = {
  title: "Редактирование гайда | Работы | Region WIKI",
};

export const dynamic = "force-dynamic";

export default async function EditJobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ jobs, editable }, canEdit] = await Promise.all([listJobs(), hasPermission("jobs.edit")]);
  const job = jobs.find((item) => item.slug === slug);
  if (!job) notFound();
  if (!canEdit || !editable) redirect(`/dashboard/jobs/${slug}`);

  return <JobEditorPage mode="edit" job={job} allJobs={jobs} />;
}
