import type { Metadata } from "next";

import { RpTermsWiki } from "@/app/(main)/(dashboard)/rp-terms/_components/rp-terms-wiki";

export const metadata: Metadata = {
  title: "RP термины | Region WIKI",
  description: "Глоссарий ролевой игры: MG, PG, DM, RK, команды /me /do /try, наказания и организации.",
  alternates: { canonical: "/rp-terms" },
};

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { q } = await searchParams;
  return <RpTermsWiki initialQuery={typeof q === "string" ? q.slice(0, 100) : ""} />;
}
