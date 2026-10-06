import type { Metadata } from "next";

import { RealtyWiki } from "@/app/(main)/dashboard/real-estate/_components/realty-wiki";
import { hasPermission } from "@/lib/auth/admin";
import { listRealties } from "@/lib/realties/store";

export const metadata: Metadata = {
  title: "Недвижимость | Region WIKI",
  description: "Каталог недвижимости штата: дома, квартиры, офисы и склады со стоимостью и характеристиками.",
};

// Недвижимость лежит в базе и меняется администрацией, поэтому страница всегда строится заново.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const [{ realties, editable }, admin] = await Promise.all([listRealties(), hasPermission("realty.edit")]);

  let editor: "on" | "off" | "unavailable" = "off";
  if (admin) editor = editable ? "on" : "unavailable";

  return <RealtyWiki initialQuery={typeof q === "string" ? q.slice(0, 100) : ""} realties={realties} editor={editor} />;
}
