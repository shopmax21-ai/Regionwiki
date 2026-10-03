import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { JobArticle } from "../_components/job-article";
import { jobBySlug, jobs } from "../_data/jobs";

export const dynamicParams = false;

export function generateStaticParams() {
  return jobs.map((job) => ({ slug: job.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const job = jobBySlug.get(slug);
  if (!job) return {};
  return { title: `${job.title} | Работы | Region WIKI`, description: job.tagline };
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = jobBySlug.get(slug);
  if (!job) notFound();
  return <JobArticle job={job} />;
}
