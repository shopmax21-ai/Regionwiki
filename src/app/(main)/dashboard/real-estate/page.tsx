import type { Metadata } from "next";

import { RealtyWiki } from "@/app/(main)/dashboard/real-estate/_components/realty-wiki";

export const metadata: Metadata = {
  title: "Недвижимость | Region WIKI",
  description: "Каталог недвижимости штата: дома, квартиры, офисы и склады со стоимостью и характеристиками.",
};

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { q } = await searchParams;
  return <RealtyWiki initialQuery={typeof q === "string" ? q.slice(0, 100) : ""} />;
}
