import type { Metadata } from "next";

import { requirePageAdmin } from "@/lib/auth/admin";
import { listOverlayFiles } from "@/lib/overlay/files";

import { OverlayPanel } from "./_components/overlay-panel";

export const metadata: Metadata = {
  title: "Оверлей для игры | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageAdmin();
  const files = await listOverlayFiles();

  return <OverlayPanel files={files} externalUrl={process.env.OVERLAY_DOWNLOAD_URL || null} />;
}
