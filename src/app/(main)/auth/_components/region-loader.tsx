import { cn } from "cn";

import { RegionMarkOutline } from "./region-mark-outline";

/**
 * Загрузка в стиле страницы 404: узор из «R» и фирменная R с красной жидкостью внутри.
 * fullscreen — на весь экран (переход между страницами), иначе — внутри области контента.
 */
export function RegionLoader({
  fullscreen = false,
  label = "Загрузка…",
  id = "rmo-loader",
}: {
  fullscreen?: boolean;
  label?: string;
  id?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative isolate flex flex-col items-center justify-center gap-6 overflow-hidden bg-background",
        fullscreen ? "fixed inset-0 z-50 min-h-dvh" : "min-h-[60dvh] rounded-xl",
      )}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 -z-10 size-full text-foreground [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]"
      >
        <defs>
          <pattern id={`${id}-pattern`} width="98" height="64" patternUnits="userSpaceOnUse">
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
        <rect width="100%" height="100%" fill={`url(#${id}-pattern)`} />
      </svg>

      <div aria-hidden="true" className="relative">
        <div className="absolute inset-4 rounded-full bg-primary/25 blur-3xl" />
        <RegionMarkOutline id={id} className="relative w-28 sm:w-36" />
      </div>
      <p className="font-medium text-muted-foreground text-sm tracking-wide">{label}</p>
    </div>
  );
}
