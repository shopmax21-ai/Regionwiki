import type { Metadata } from "next";

import { CatalogPage } from "../_components/catalog/catalog-page";
import { itemsConfig } from "../_components/catalog/items-config";

export const metadata: Metadata = {
  title: itemsConfig.metaTitle,
  description: itemsConfig.metaDescription,
  alternates: {
    canonical: itemsConfig.basePath,
  },
};

interface PageProps {
  searchParams: Promise<{ view?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { view } = await searchParams;

  return <CatalogPage config={itemsConfig} view={view === "list" ? "list" : "grid"} />;
}
