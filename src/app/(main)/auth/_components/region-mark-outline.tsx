import { cn } from "cn";

// Силуэт буквы R из фирменного логотипа
const R_PATH =
  "M12.252 30.5459C13.1582 30.546 13.9836 31.0646 14.3721 31.8789L19.2012 42H10.3662C9.43069 41.9999 8.58456 41.4474 8.21289 40.5938L5.25879 33.8057C4.58842 32.2653 5.72408 30.5462 7.41211 30.5459H12.252ZM23.5176 0C28.6786 0 32.8302 1.44515 35.9707 4.33496C39.1311 7.20522 40.7109 10.8667 40.7109 15.3184C40.7109 16.9583 40.4713 18.5007 39.9912 19.9453C39.5313 21.3707 38.9709 22.5324 38.3105 23.4307C37.6505 24.3288 36.9905 25.1106 36.3301 25.7744C35.6902 26.4381 35.1398 26.9063 34.6797 27.1797L33.96 27.5898L42.2412 42H30.5635C29.4369 41.9998 28.4098 41.3584 27.9209 40.3496L23.2002 30.6064L16.918 18.5029H28.4326C29.1728 18.5029 29.5085 18.3499 30.2412 17.6592C30.7818 17.1494 30.9609 15.4236 30.9609 14.3184C30.9609 13.2132 30.0138 12.0773 29.458 11.6055C28.9022 11.1337 27.4473 10.9043 26.707 10.9043H13.6797L11.6523 6.38281C11.3709 5.75491 10.876 5.24535 10.2539 4.94531L0 0H23.5176Z";

// Волна с периодом 20: сдвиг ровно на 20 даёт бесшовный цикл
const WAVE = "M-20 0q5 -3 10 0t10 0t10 0t10 0t10 0t10 0t10 0t10 0V40H-20Z";

const CSS = `
.rmo-front{animation:rmo-flow 3.2s linear infinite}
.rmo-back{animation:rmo-flow-rev 5.4s linear infinite}
.rmo-level{animation:rmo-bob 4.8s ease-in-out infinite}
@keyframes rmo-flow{from{transform:translateX(0)}to{transform:translateX(20px)}}
@keyframes rmo-flow-rev{from{transform:translateX(20px)}to{transform:translateX(0)}}
@keyframes rmo-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@media (prefers-reduced-motion:reduce){.rmo-front,.rmo-back,.rmo-level{animation:none}}
`;

/** Буква R контуром: внутри красная «жидкость» с бегущими волнами. */
export function RegionMarkOutline({ className, id = "rmo" }: { className?: string; id?: string }) {
  return (
    <svg viewBox="-2 -2 47 46" fill="none" aria-hidden="true" className={cn("overflow-visible", className)}>
      <style>{CSS}</style>
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={R_PATH} />
        </clipPath>
      </defs>

      <path d={R_PATH} className="fill-foreground/[0.03]" />

      <g clipPath={`url(#${id}-clip)`}>
        <g className="rmo-level">
          <g transform="translate(0 22)">
            <g className="rmo-back">
              <path d={WAVE} transform="translate(0 -2.5)" className="fill-primary/45" />
            </g>
            <g className="rmo-front">
              <path d={WAVE} transform="translate(0 1)" className="fill-primary" />
            </g>
          </g>
        </g>
      </g>

      <path
        d={R_PATH}
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-foreground/80"
      />
    </svg>
  );
}
