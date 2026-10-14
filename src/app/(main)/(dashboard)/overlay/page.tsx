import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth/admin";
import { listOverlayFiles } from "@/lib/overlay/files";
import { getUserTokenInfo } from "@/lib/overlay/user-token";

import { OverlayPanel } from "./_components/overlay-panel";

export const metadata: Metadata = {
  title: "Оверлей для игры | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const admin = await requireAdmin();
  const [files, keyInfo] = await Promise.all([listOverlayFiles(), getUserTokenInfo(admin.id)]);

  return (
    <OverlayPanel files={files} externalUrl={process.env.OVERLAY_DOWNLOAD_URL || null} keyInfo={keyInfo} />
  );
}
