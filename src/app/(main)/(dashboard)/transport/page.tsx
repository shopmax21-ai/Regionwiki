import type { Metadata } from "next";

import { TransportWiki } from "@/app/(main)/(dashboard)/transport/_components/transport-wiki";
import { hasPermission } from "@/lib/auth/admin";
import { listVehicles } from "@/lib/vehicles/store";

export const metadata: Metadata = {
  title: "Транспорт | Region WIKI",
  description: "Документы и материалы раздела Транспорт.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ vehicles, editable }, admin] = await Promise.all([listVehicles(), hasPermission("transport.edit")]);
  const editor = !admin ? "off" : editable ? "on" : "unavailable";

  return <TransportWiki vehicles={vehicles} editor={editor} />;
}
