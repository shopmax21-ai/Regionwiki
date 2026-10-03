import type { ReactNode } from "react";

import { APP_CONFIG } from "@/config/app-config";

import { RegionMarkOutline } from "../_components/region-mark-outline";

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="region-auth dark h-dvh overflow-hidden bg-background text-foreground">
      <div className="grid h-full p-2 lg:grid-cols-2">
        {/* Левая колонка: форма */}
        <div className="relative order-1 flex h-full min-h-0 items-center justify-center overflow-hidden px-6">
          <div className="flex w-full max-w-[372px] flex-col gap-5 [@media(max-height:720px)]:gap-3">{children}</div>
          <p className="absolute bottom-4 text-muted-foreground text-xs [@media(max-height:760px)]:hidden">{APP_CONFIG.copyright}</p>
        </div>

        {/* Правая панель: узор из букв R и большой логотип */}
        <div className="relative order-2 hidden h-full items-center justify-center overflow-hidden rounded-2xl bg-card lg:flex">
          <svg aria-hidden="true" className="absolute inset-0 size-full text-foreground">
            <defs>
              <pattern id="region-r-pattern" width="98" height="64" patternUnits="userSpaceOnUse">
                <g fill="currentColor" fillOpacity="0.045" fontSize="20" fontStyle="italic" fontWeight="800">
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
            <rect width="100%" height="100%" fill="url(#region-r-pattern)" />
          </svg>
          <RegionMarkOutline id="rmo-auth" className="relative w-72 xl:w-80" />
        </div>
      </div>
    </main>
  );
}
