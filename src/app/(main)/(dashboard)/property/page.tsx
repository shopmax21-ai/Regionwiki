import type { Metadata } from "next";

import { CatalogPage } from "../_components/catalog/catalog-page";
import { propertyConfig } from "../_components/catalog/property-config";

export const metadata: Metadata = {
  title: propertyConfig.metaTitle,
  description: propertyConfig.metaDescription,
  alternates: {
    canonical: propertyConfig.basePath,
  },
};

interface PageProps {
  searchParams: Promise<{ view?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { view } = await searchParams;

  return <CatalogPage config={propertyConfig} view={view === "list" ? "list" : "grid"} />;
}
