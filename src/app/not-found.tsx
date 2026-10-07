import Link from "next/link";

import { ArrowRight, BriefcaseBusiness, CarFront, HardHat, House, Map as MapIcon } from "lucide-react";
import type { Metadata } from "next";

import { RegionLogo } from "@/app/(main)/auth/_components/region-logo";
import { RegionMarkOutline } from "@/app/(main)/auth/_components/region-mark-outline";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Страница не найдена | Region WIKI",
  robots: { index: false, follow: false },
};

const links = [
  { title: "Работы", href: "/jobs", icon: HardHat },
  { title: "Бизнес", href: "/business", icon: BriefcaseBusiness },
  { title: "Недвижимость", href: "/real-estate", icon: House },
  { title: "Транспорт", href: "/transport", icon: CarFront },
  { title: "Карта штата", href: "/map", icon: MapIcon },
];

const CSS = `
.nf-digit{display:inline-block;padding:.04em .16em .04em .08em;margin:-.04em -.16em -.04em -.08em;color:transparent;background-image:linear-gradient(100deg,var(--primary) 38%,#e63f3f 50%,var(--primary) 62%);background-size:300% 100%;background-position:100% 0;-webkit-background-clip:text;background-clip:text;animation:nf-drop .8s cubic-bezier(.2,.9,.3,1.25) both,nf-shine 3.4s ease-in-out infinite}
@keyframes nf-drop{from{opacity:0;transform:translateY(-.55em) rotate(-8deg)}to{opacity:1;transform:none}}
@keyframes nf-shine{from{background-position:100% 0}to{background-position:0% 0}}
@media (prefers-reduced-motion:reduce){.nf-digit{animation:none}}
`;

export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-dvh items-center overflow-hidden bg-background">
      <style>{CSS}</style>
      {/* Узор из «R», затухающий к тексту */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 -z-10 size-full text-foreground [mask-image:linear-gradient(to_right,transparent_30%,black)]"
      >
        <defs>
          <pattern id="region-404-pattern" width="98" height="64" patternUnits="userSpaceOnUse">
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
        <rect width="100%" height="100%" fill="url(#region-404-pattern)" />
      </svg>

      {/* Фирменная R, уходящая за нижний край */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -bottom-24 hidden md:block lg:right-16">
        <div className="absolute inset-10 rounded-full bg-primary/25 blur-3xl" />
        <RegionMarkOutline id="rmo-404" className="relative w-96 lg:w-[28rem]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-6 py-16 md:px-12">
        <RegionLogo className="text-3xl" />

        <div className="mt-14 max-w-xl">
          <p
            role="img"
            aria-label="404"
            className="flex font-extrabold text-8xl italic leading-none tracking-tighter md:text-9xl"
          >
            {["4", "0", "4"].map((digit, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: статичный список из трёх цифр
                key={index}
                aria-hidden="true"
                className="nf-digit"
                style={{ animationDelay: `${index * 120}ms, ${800 + index * 250}ms` }}
              >
                {digit}
              </span>
            ))}
          </p>
          <h1 className="mt-6 text-balance font-semibold text-3xl tracking-tight md:text-4xl">
            Такой страницы нет в Region WIKI
          </h1>
          <p className="mt-4 text-base text-muted-foreground leading-7">
            Ссылка могла устареть, или в адресе опечатка. Вернитесь на главную или откройте нужный раздел.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" prefetch={false} className={buttonVariants({ size: "lg", className: "h-11 px-5" })}>
              На главную
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-2">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    prefetch={false}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-sm transition-colors hover:border-primary/60 hover:text-primary"
                  >
                    <Icon className="size-3.5" />
                    {link.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </main>
  );
}
