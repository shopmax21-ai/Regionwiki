import type { Metadata } from "next";

import { BusinessWiki } from "@/app/(main)/dashboard/business/_components/business-wiki";
import { hasPermission } from "@/lib/auth/admin";
import { listBusinesses } from "@/lib/businesses/store";
import { listMapPlaces } from "@/lib/map/store";

export const metadata: Metadata = {
  title: "Бизнесы | Region WIKI",
  description: "Каталог бизнесов штата: магазины, заправки, банкоматы, салоны и мастерские со стоимостью.",
};

// Бизнесы лежат в базе и меняются администрацией, поэтому страница всегда строится заново.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const [{ businesses, editable }, admin] = await Promise.all([listBusinesses(), hasPermission("business.edit")]);

  let editor: "on" | "off" | "unavailable" = "off";
  if (admin) editor = editable ? "on" : "unavailable";

  // Метки карты нужны только редактору: из них берутся готовые координаты
  const mapPlaces =
    editor === "on"
      ? (await listMapPlaces()).places
          .map(({ id, name, x, y }) => ({ id, name, x, y }))
          .sort((a, b) => a.name.localeCompare(b.name, "ru"))
      : [];

  return (
    <BusinessWiki
      initialQuery={typeof q === "string" ? q.slice(0, 100) : ""}
      businesses={businesses}
      editor={editor}
      mapPlaces={mapPlaces}
    />
  );
}
