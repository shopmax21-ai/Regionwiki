"use client";

import { useEffect, useRef, useState } from "react";

import { ExternalLink, Eye, LoaderCircle } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MediaStream } from "@/lib/media/types";

import { formatUptime, formatViewers, initials } from "./format";

type StreamCardProps = {
  stream: MediaStream;
  /** Домен сайта: Twitch разрешает встраивать плеер только на указанный в parent. null, пока он неизвестен (до загрузки в браузере) */
  hostname: string | null;
  /** Время проверки Twitch: от него считается длительность эфира */
  checkedAt: string | null;
};

/** Плеер подгружается, только когда карточка подъехала к экрану: десятки плееров сразу сильно нагружают страницу. */
function useNearViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  return { ref, near };
}

export function StreamCard({ stream, hostname, checkedAt }: StreamCardProps) {
  const { ref, near } = useNearViewport();
  const [loaded, setLoaded] = useState(false);
  const uptime = formatUptime(stream.startedAt, checkedAt);

  // autoplay выключен: иначе все плееры на странице запустились бы одновременно
  const playerSrc =
    near && hostname
      ? `https://player.twitch.tv/?channel=${encodeURIComponent(stream.login)}&parent=${encodeURIComponent(hostname)}&muted=true&autoplay=false`
      : null;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar className="size-10">
          {stream.avatar && <AvatarImage src={stream.avatar} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback>{initials(stream.name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold leading-tight tracking-tight">{stream.name}</h2>
          <p className="truncate text-muted-foreground text-xs">
            {[stream.game, uptime && `в эфире ${uptime}`].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span
            className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 font-semibold text-destructive text-sm tabular-nums"
            title="Зрителей сейчас"
          >
            <Eye className="size-4" aria-hidden="true" />
            <span className="sr-only">Зрителей сейчас:</span>
            {formatViewers(stream.viewers)}
          </span>
          <Button asChild variant="ghost" size="icon-sm">
            <a
              href={stream.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Открыть трансляцию ${stream.name} на Twitch`}
              title="Открыть на Twitch"
            >
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>

      <div ref={ref} className="relative aspect-video w-full bg-muted">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
          </div>
        )}
        {playerSrc && (
          <iframe
            src={playerSrc}
            title={`Трансляция ${stream.name}`}
            className="absolute inset-0 size-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>

      {stream.title && (
        <p className="line-clamp-2 border-t px-4 py-3 text-sm" title={stream.title}>
          {stream.title}
        </p>
      )}
    </Card>
  );
}
