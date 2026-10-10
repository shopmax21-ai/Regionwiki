"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";

import { type LucideIcon, RefreshCw, TriangleAlert, Tv } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import { ChannelsManager } from "./channels-manager";
import { formatViewers } from "./format";
import { NotifySwitch } from "./notify-switch";
import { StreamCard } from "./stream-card";
import { useMediaStreams } from "./use-media-streams";

const PAGE_SIZE = 12;

// Домен нужен для параметра parent у плеера Twitch. На сервере его нет, поэтому до гидратации плеер не рисуется.
const subscribeNothing = () => () => undefined;
const getHostname = () => window.location.hostname;
const getServerHostname = () => null;

const pluralStreams = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "трансляция";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "трансляции";
  return "трансляций";
};

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function StreamsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {["a", "b", "c"].map((key) => (
        <Card key={key} className="gap-0 overflow-hidden py-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-7 w-16" />
          </div>
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="border-t px-4 py-3">
            <Skeleton className="h-4 w-3/4" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Empty className="border py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  );
}

type MediaSectionProps = {
  isAdmin: boolean;
  /** Есть право «Управление каналами «Медиа»» */
  canManage: boolean;
  /** Личная настройка: оповещения в Telegram о начале трансляций */
  notifyEnabled: boolean;
};

export function MediaSection({ isAdmin, canManage, notifyEnabled }: MediaSectionProps) {
  const { data, failed, refreshing, reload } = useMediaStreams();
  const hostname = useSyncExternalStore(subscribeNothing, getHostname, getServerHostname);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const streams = data?.streams ?? [];
  const totalViewers = streams.reduce((sum, stream) => sum + stream.viewers, 0);
  const showStreams = data?.status === "ok" && streams.length > 0;
  const channels = data?.channels ?? [];
  const liveLogins = new Set(streams.map((stream) => stream.login.toLowerCase()));
  const offlineChannels = channels.filter((channel) => !liveLogins.has(channel.login));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-col items-center gap-3 py-4 text-center md:py-6">
        <h1 className="font-semibold text-3xl tracking-tight md:text-5xl">Медиа</h1>
        <p className="max-w-xl text-muted-foreground text-sm">
          Трансляции игроков REGION на Twitch. Список обновляется сам: показываются каналы, которые добавила
          администрация, и стримы с названием проекта в заголовке, имени канала или тегах.
        </p>
      </header>

      {isAdmin && (
        <section className="flex flex-wrap items-center justify-end gap-2" aria-label="Настройки раздела">
          <NotifySwitch initialEnabled={notifyEnabled} />
          {canManage && data && (
            <ChannelsManager channels={channels} streams={streams} onChanged={() => void reload()} />
          )}
        </section>
      )}

      {data?.status === "ok" && (
        <section className="flex flex-wrap items-center justify-between gap-3" aria-label="Сводка по трансляциям">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="h-7 gap-1.5 px-2.5 text-sm">
              <span className="size-2 rounded-full bg-destructive" aria-hidden="true" />В эфире: {streams.length}{" "}
              {pluralStreams(streams.length)}
            </Badge>
            {streams.length > 0 && (
              <Badge variant="outline" className="h-7 px-2.5 text-sm">
                Зрителей: {formatViewers(totalViewers)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            {data.stale && <span>Twitch не отвечает, показаны прошлые данные</span>}
            {data.updatedAt && <span>Обновлено в {formatTime(data.updatedAt)}</span>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reload()}
              disabled={refreshing}
              aria-label="Обновить список трансляций"
            >
              <RefreshCw className={refreshing ? "animate-spin" : undefined} aria-hidden="true" />
              Обновить
            </Button>
          </div>
        </section>
      )}

      {!data && !failed && <StreamsSkeleton />}

      {!data && failed && (
        <Notice
          icon={TriangleAlert}
          title="Не удалось загрузить трансляции"
          description="Проверьте соединение и попробуйте ещё раз."
          action={
            <Button variant="outline" onClick={() => void reload()} disabled={refreshing}>
              Повторить
            </Button>
          }
        />
      )}

      {data?.status === "unconfigured" && (
        <Notice
          icon={Tv}
          title="Трансляции пока недоступны"
          description={
            isAdmin
              ? "Задайте TWITCH_CLIENT_ID и TWITCH_CLIENT_SECRET в переменных окружения сервера (приложение создаётся на dev.twitch.tv/console)."
              : "Раздел ещё настраивается. Загляните позже."
          }
        />
      )}

      {data?.status === "error" && (
        <Notice
          icon={TriangleAlert}
          title="Twitch сейчас не отвечает"
          description="Список трансляций временно недоступен, попробуйте обновить страницу через минуту."
          action={
            <Button variant="outline" onClick={() => void reload()} disabled={refreshing}>
              Повторить
            </Button>
          }
        />
      )}

      {data?.status === "ok" && streams.length === 0 && (
        <Notice
          icon={Tv}
          title="Сейчас никто не стримит"
          description="Как только отслеживаемый канал или игрок с названием проекта в заголовке начнёт трансляцию, она появится здесь сама."
        />
      )}

      {showStreams && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {streams.slice(0, visibleCount).map((stream) => (
              <StreamCard key={stream.id} stream={stream} hostname={hostname} checkedAt={data.updatedAt} />
            ))}
          </div>
          {streams.length > visibleCount && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                Показать ещё ({streams.length - visibleCount})
              </Button>
            </div>
          )}
        </>
      )}

      {offlineChannels.length > 0 && data?.status !== "error" && (
        <section className="flex flex-col gap-3" aria-label="Каналы не в эфире">
          <h2 className="font-medium text-muted-foreground text-sm">Отслеживаемые каналы, сейчас не в эфире</h2>
          <ul className="flex flex-wrap gap-2">
            {offlineChannels.map((channel) => (
              <li key={channel.login}>
                <Button asChild variant="outline" size="sm">
                  <a href={channel.url} target="_blank" rel="noopener noreferrer">
                    {channel.name}
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
