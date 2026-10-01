import type { Metadata } from "next";

import { createDirectoryData } from "@/app/(main)/dashboard/_components/directory-data";
import { DirectoryPage } from "@/app/(main)/dashboard/_components/directory-page";

export const metadata: Metadata = {
  title: "Работы | Region WIKI",
  description: "Документы и материалы раздела Работы.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  const data = createDirectoryData("jobs");
  return (
    <DirectoryPage
      title="Работы"
      description="Вакансии, резюме и полезные материалы о работе."
      viewPath="/dashboard/jobs"
      view={view}
      {...data}
    />
  );
}
