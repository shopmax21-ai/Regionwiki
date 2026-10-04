import type { Metadata } from "next";

import { ItemsWiki } from "@/app/(main)/dashboard/items/_components/items-wiki";

export const metadata: Metadata = {
  title: "Предметы | Region WIKI",
  description: "Таблица предметов проекта: продукты, инструменты, материалы, одежда, медицина и другие категории.",
  alternates: { canonical: "/dashboard/items" },
};

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { q } = await searchParams;
  return <ItemsWiki initialQuery={typeof q === "string" ? q.slice(0, 100) : ""} />;
}
