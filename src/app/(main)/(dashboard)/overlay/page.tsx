import { headers } from "next/headers";

import type { Metadata } from "next";

import { listOverlayFiles } from "@/lib/overlay/files";

import { OverlayPanel } from "./_components/overlay-panel";

export const metadata: Metadata = {
  title: "Оверлей для игры | Region WIKI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const files = await listOverlayFiles();

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const siteUrl = host ? `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${host}` : "";

  // Публичная страница не раскрывает токен подключения: он предназначен только для доверенных пользователей.
  const configured = Boolean(process.env.OVERLAY_TOKEN);
  const token = null;

  return (
    <OverlayPanel
      files={files}
      siteUrl={siteUrl}
      token={token}
      tokenConfigured={configured}
      externalUrl={process.env.OVERLAY_DOWNLOAD_URL || null}
    />
  );
}
