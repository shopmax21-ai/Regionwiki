import type { Metadata } from "next";

import { AcademyStoreError, getInviteLanding } from "@/lib/academy/store";
import type { InviteLanding } from "@/lib/academy/types";

import { RegionLogo } from "@/app/(main)/auth/_components/region-logo";
import { RegionMarkOutline } from "@/app/(main)/auth/_components/region-mark-outline";

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
    <main className="relative isolate flex min-h-dvh flex-col items-center overflow-hidden bg-background px-4 py-8 sm:py-12">
      {/* Узор из «R», затухающий к центру карточки */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 -z-10 size-full text-foreground [mask-image:radial-gradient(circle_at_center,transparent_15%,black)]"
      >
        <defs>
          <pattern id="region-test-pattern" width="98" height="64" patternUnits="userSpaceOnUse">
            <g fill="currentColor" fillOpacity="0.05" fontSize="20" fontStyle="italic" fontWeight="800">
              <text x="0" y="24">
                R
              </text>
              <text x="49" y="24">
                R
              </text>
              <text x="24" y="56">
                R
              </text>
              <text x="73" y="56">
                R
              </text>
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#region-test-pattern)" />
      </svg>

      {/* Фирменная R с красным свечением, уходящая за нижний край */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -bottom-28 -z-10 hidden lg:block">
        <div className="absolute inset-10 rounded-md bg-primary/20 blur-3xl" />
        <RegionMarkOutline id="rmo-test" className="relative w-96 opacity-80" />
      </div>

      <header className="flex flex-col items-center gap-2 text-center">
        <RegionLogo className="text-3xl" />
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-widest">Академия</p>
      </header>

      <div className="flex w-full flex-1 items-center justify-center py-8">
        <div className="w-full max-w-2xl">
          <GuestQuiz token={token} landing={landing} />
        </div>
      </div>

      <footer className="text-center text-muted-foreground text-xs">
        Region WIKI · личная ссылка на тест, не передавайте её другим
      </footer>
    </main>
  );
}
