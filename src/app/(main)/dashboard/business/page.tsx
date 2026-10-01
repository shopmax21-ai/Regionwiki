import type { Metadata } from "next";

import { createDirectoryData } from "@/app/(main)/dashboard/_components/directory-data";
import { DirectoryPage } from "@/app/(main)/dashboard/_components/directory-page";

export const metadata: Metadata = {
  title: "Бизнес | Region WIKI",
  description: "Документы и материалы раздела Бизнес.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  const data = createDirectoryData("business");
  return (
    <DirectoryPage
      title="Бизнес"
      description="Объявления, документы и материалы для бизнеса."
      viewPath="/dashboard/business"
      view={view}
      {...data}
    />
  );
}
