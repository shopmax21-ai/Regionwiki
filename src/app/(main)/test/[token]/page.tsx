import type { Metadata } from "next";

import { AcademyStoreError, getInviteLanding } from "@/lib/academy/store";
import type { InviteLanding } from "@/lib/academy/types";

import { GuestQuiz } from "./_components/guest-quiz";

export const metadata: Metadata = {
  title: "Тест | Region WIKI",
  // Ссылка личная: в поиске и превью ей делать нечего
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let landing: InviteLanding | null = null;
  try {
    landing = await getInviteLanding(token);
  } catch (error) {
    if (!(error instanceof AcademyStoreError)) throw error;
    console.error("[academy] Не удалось открыть ссылку на тест", error);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl">
        <GuestQuiz token={token} landing={landing} />
      </div>
    </main>
  );
}
