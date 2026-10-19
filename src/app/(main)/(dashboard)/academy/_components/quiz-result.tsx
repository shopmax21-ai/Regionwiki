import type { CSSProperties, ReactNode } from "react";

import { cn } from "cn";
import { PartyPopper, Target } from "lucide-react";

import { RegionMarkOutline } from "@/app/(main)/auth/_components/region-mark-outline";
import { Card, CardContent } from "@/components/ui/card";

const CSS = `
.qr-ring{stroke-dasharray:var(--qr-len);stroke-dashoffset:var(--qr-len);animation:qr-fill 1.1s cubic-bezier(.3,.8,.3,1) .15s forwards}
.qr-pop{animation:qr-pop .6s cubic-bezier(.2,.9,.3,1.3) both}
.qr-rise{animation:qr-rise .55s ease-out both}
@keyframes qr-fill{to{stroke-dashoffset:var(--qr-off)}}
@keyframes qr-pop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:none}}
@keyframes qr-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.qr-ring,.qr-pop,.qr-rise{animation:none}.qr-ring{stroke-dashoffset:var(--qr-off)}}
`;

const RADIUS = 52;
const LENGTH = 2 * Math.PI * RADIUS;

type QuizResultProps = {
  passed: boolean;
  title: string;
  score: number;
  total: number;
  percent: number;
  passPercent: number;
  /** Кнопки или подпись под результатом */
  actions: ReactNode;
};

/** Экран завершения теста: «сдал» — зелёный с праздничным акцентом, «не сдал» — красный и спокойный. */
export function QuizResult({ passed, title, score, total, percent, passPercent, actions }: QuizResultProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = LENGTH * (1 - clamped / 100);
  const tone = passed
    ? { text: "text-green-600 dark:text-green-400", glow: "bg-green-500/20", border: "border-green-500/30" }
    : { text: "text-destructive", glow: "bg-primary/20", border: "border-destructive/30" };
  const Icon = passed ? PartyPopper : Target;

  return (
    <Card className={cn("relative isolate overflow-hidden", tone.border)}>
      <style>{CSS}</style>
      <div aria-hidden="true" className="pointer-events-none absolute -right-14 -bottom-20 -z-10 hidden opacity-40 sm:block">
        <div className={cn("absolute inset-8 rounded-md blur-3xl", tone.glow)} />
        <RegionMarkOutline id={passed ? "rmo-quiz-pass" : "rmo-quiz-fail"} className="relative w-56" />
      </div>
      <div
        aria-hidden="true"
        className={cn("-z-10 absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent", passed ? "from-green-500/10" : "from-destructive/10")}
      />

      <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
        <div className="qr-pop relative size-40">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={`Результат ${percent}%`}>
            <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="8" className="stroke-muted" />
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={cn("qr-ring", passed ? "stroke-green-500" : "stroke-destructive")}
              style={{ "--qr-len": LENGTH, "--qr-off": offset } as CSSProperties}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-extrabold text-4xl tabular-nums italic leading-none", tone.text)}>{percent}%</span>
            <span className="mt-1 text-muted-foreground text-xs">порог {passPercent}%</span>
          </div>
        </div>

        <div className="qr-rise flex flex-col items-center gap-2" style={{ animationDelay: "250ms" }}>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-extrabold text-sm uppercase tracking-wider",
              passed ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-destructive/15 text-destructive",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {passed ? "Тест сдан" : "Тест не сдан"}
          </span>
          <h2 className="font-semibold text-xl leading-tight">
            {passed ? "Отличная работа!" : "Пока не получилось"}
          </h2>
          <p className="max-w-md text-muted-foreground text-sm">
            {title}: {score} из {total} правильных ответов. Проходной балл — {passPercent}%.
            {!passed && " Повторите правила и попробуйте ещё раз."}
          </p>
        </div>

        <div className="qr-rise flex flex-col items-center gap-2" style={{ animationDelay: "400ms" }}>
          {actions}
        </div>
      </CardContent>
    </Card>
  );
}
