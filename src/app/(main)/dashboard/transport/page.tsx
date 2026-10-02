import type { Metadata } from "next";

import { TransportWiki } from "@/app/(main)/dashboard/transport/_components/transport-wiki";

export const metadata: Metadata = {
  title: "Транспорт | Region WIKI",
  description: "Документы и материалы раздела Транспорт.",
};

export default function Page() {
  return <TransportWiki />;
}
