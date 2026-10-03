import { cn } from "cn";

import { RegionMark } from "./region-mark";

/** Логотип: фирменная буква R + красный бейдж «WIKI». */
export function RegionLogo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Region WIKI"
      className={cn("inline-flex select-none items-center gap-[0.3em] text-5xl leading-none", className)}
    >
      <RegionMark gradientId="region-r-grad-logo" className="h-[0.8em] w-auto" />
      <span
        aria-hidden="true"
        className="rounded-[0.3em] bg-primary px-[0.32em] py-[0.14em] font-extrabold text-[0.42em] text-primary-foreground uppercase italic leading-none tracking-wider shadow-lg shadow-primary/30"
      >
        Wiki
      </span>
    </span>
  );
}
