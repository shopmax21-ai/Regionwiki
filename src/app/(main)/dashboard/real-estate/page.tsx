import type { Metadata } from "next";

import { createDirectoryData } from "@/app/(main)/dashboard/_components/directory-data";
import { DirectoryPage } from "@/app/(main)/dashboard/_components/directory-page";

export const metadata: Metadata = {
  title: "Недвижимость | Region WIKI",
  description: "Документы и материалы раздела Недвижимость.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  const data = createDirectoryData("real-estate");
  return (
    <DirectoryPage
      title="Недвижимость"
      description="Объявления, документы и материалы о недвижимости."
      viewPath="/dashboard/real-estate"
      view={view}
      {...data}
    />
  );
}
