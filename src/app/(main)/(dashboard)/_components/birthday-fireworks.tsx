"use client";

import { useEffect, useRef, useState } from "react";

import { Cake, X } from "lucide-react";

import { markGreeted } from "../birthday-actions";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  hue: number;
  size: number;
};

type Rocket = { x: number; y: number; vy: number; targetY: number; hue: number };

/** Сколько секунд запускаются новые залпы, после этого догорают последние искры */
const SHOW_SECONDS = 9;

/**
 * Праздничный фейерверк на всё окно при первом входе в день рождения. Не мешает работе: слой не ловит клики,
 * а при включённом «уменьшении движения» вместо салюта показывается только поздравление.
 * Показывается один раз в день: отметка ставится на сервере, поэтому повторный вход (и другое устройство) его не запускают.
 */
export function BirthdayFireworks({ name }: { name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fireworks, setFireworks] = useState(true);
  const [banner, setBanner] = useState(true);

  useEffect(() => {
    markGreeted().catch(() => undefined);
    const timer = setTimeout(() => setBanner(false), 12_000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!(canvas && fireworks)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFireworks(false);
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    const started = performance.now();
    let last = started;
    let nextLaunch = 0;
    let frame = 0;

    const launch = () => {
      rockets.push({
        x: width * (0.12 + Math.random() * 0.76),
        y: height + 10,
        vy: -(height * (0.75 + Math.random() * 0.25)),
        targetY: height * (0.15 + Math.random() * 0.4),
        hue: Math.random() * 360,
      });
    };

    const burst = (x: number, y: number, hue: number) => {
      const count = 70 + Math.floor(Math.random() * 50);
      for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2 + Math.random() * 0.2;
        const speed = 60 + Math.random() * 230;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.45 + Math.random() * 0.55,
          hue: (hue + Math.random() * 40 - 20 + 360) % 360,
          size: 1.5 + Math.random() * 1.8,
        });
      }
    };

    const tick = (time: number) => {
      const delta = Math.min((time - last) / 1000, 0.05);
      last = time;
      const elapsed = (time - started) / 1000;

      if (elapsed < SHOW_SECONDS && time >= nextLaunch) {
        launch();
        if (Math.random() < 0.4) launch();
        nextLaunch = time + 260 + Math.random() * 380;
      }

      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      for (let index = rockets.length - 1; index >= 0; index--) {
        const rocket = rockets[index];
        rocket.y += rocket.vy * delta;
        rocket.vy *= 0.985;
        context.fillStyle = `hsl(${rocket.hue} 100% 80%)`;
        context.beginPath();
        context.arc(rocket.x, rocket.y, 2.2, 0, Math.PI * 2);
        context.fill();
        if (rocket.y <= rocket.targetY || Math.abs(rocket.vy) < 40) {
          burst(rocket.x, rocket.y, rocket.hue);
          rockets.splice(index, 1);
        }
      }

      for (let index = particles.length - 1; index >= 0; index--) {
        const particle = particles[index];
        particle.vx *= 0.985;
        particle.vy = particle.vy * 0.985 + 120 * delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.life -= particle.decay * delta;
        if (particle.life <= 0) {
          particles.splice(index, 1);
          continue;
        }
        context.fillStyle = `hsl(${particle.hue} 100% ${55 + particle.life * 25}% / ${particle.life})`;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * (0.5 + particle.life * 0.5), 0, Math.PI * 2);
        context.fill();
      }

      if (elapsed < SHOW_SECONDS || rockets.length > 0 || particles.length > 0) {
        frame = requestAnimationFrame(tick);
      } else {
        setFireworks(false);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [fireworks]);

  return (
    <>
      {fireworks && (
        // biome-ignore lint/a11y/noAriaHiddenOnFocusable: холст декоративный и не получает фокус
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9998]" />
      )}
      {banner && (
        <div
          role="status"
          className="fade-in-0 slide-in-from-top-4 fixed top-4 left-1/2 z-[9999] flex w-[min(92vw,26rem)] -translate-x-1/2 animate-in items-center gap-3 rounded-2xl border border-pink-500/30 bg-background/95 px-4 py-3 shadow-xl backdrop-blur"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pink-500/15 text-pink-500">
            <Cake className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-semibold text-sm">С днём рождения!</p>
            <p className="truncate text-muted-foreground text-xs">{name}, команда Region желает вам отличного дня.</p>
          </div>
          <button
            type="button"
            onClick={() => setBanner(false)}
            aria-label="Закрыть поздравление"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </>
  );
}
