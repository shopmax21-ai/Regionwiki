import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { hasPermission } from "@/lib/auth/admin";
import { listJobs } from "@/lib/jobs/store";

import { JobArticle } from "../_components/job-article";
import type { JobEditorState } from "../_data/jobs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { jobs } = await listJobs();
  const job = jobs.find((item) => item.slug === slug);
  if (!job) return {};
  return { title: `${job.title} | Работы | Region WIKI`, description: job.tagline };
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ jobs, editable }, canEdit] = await Promise.all([listJobs(), hasPermission("jobs.edit")]);
  const job = jobs.find((item) => item.slug === slug);
  if (!job) notFound();

  const editor: JobEditorState = !canEdit ? "off" : editable ? "on" : "unavailable";
  return <JobArticle job={job} jobs={jobs} editor={editor} />;
}
