import type { Metadata } from "next";

import { BusinessWiki } from "@/app/(main)/dashboard/business/_components/business-wiki";

export const metadata: Metadata = {
  title: "Бизнесы | Region WIKI",
  description: "Каталог бизнесов штата: магазины, заправки, банкоматы, салоны и мастерские со стоимостью.",
};

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { q } = await searchParams;
  return <BusinessWiki initialQuery={typeof q === "string" ? q.slice(0, 100) : ""} />;
}
