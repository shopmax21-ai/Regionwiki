import type { Metadata } from "next";

import { createDirectoryData } from "@/app/(main)/dashboard/_components/directory-data";
import { DirectoryPage } from "@/app/(main)/dashboard/_components/directory-page";

export const metadata: Metadata = {
  title: "Транспорт | Region WIKI",
  description: "Документы и материалы раздела Транспорт.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  const data = createDirectoryData("transport");
  return (
    <DirectoryPage
      title="Транспорт"
      description="Объявления, документы и материалы о транспорте."
      viewPath="/dashboard/transport"
      view={view}
      {...data}
    />
  );
}
