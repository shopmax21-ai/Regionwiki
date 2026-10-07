import type { Metadata } from "next";

import { ItemsWiki } from "@/app/(main)/(dashboard)/items/_components/items-wiki";
import { hasPermission } from "@/lib/auth/admin";
import { listItems } from "@/lib/items/store";

export const metadata: Metadata = {
  title: "Предметы | Region WIKI",
  description: "Таблица предметов проекта: продукты, инструменты, материалы, одежда, медицина и другие категории.",
  alternates: { canonical: "/items" },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const [{ q }, { items, editable }, admin] = await Promise.all([
    searchParams,
    listItems(),
    hasPermission("items.edit"),
  ]);
  const editor = !admin ? "off" : editable ? "on" : "unavailable";

  return <ItemsWiki items={items} initialQuery={typeof q === "string" ? q.slice(0, 100) : ""} editor={editor} />;
}
