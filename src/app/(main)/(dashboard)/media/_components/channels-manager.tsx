"use client";

import { type FormEvent, useState, useTransition } from "react";

import { Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  channelKey,
  type MediaPlatform,
  type MediaStream,
  platformLabels,
  type TrackedChannel,
} from "@/lib/media/types";

import { addChannelAction, type MediaActionResult, removeChannelAction, setChannelNotifyAction } from "../_actions";

type Props = {
  channels: TrackedChannel[];
  streams: MediaStream[];
  /** Обновить список трансляций после изменения */
  onChanged: () => void;
};

const NETWORK_ERROR = { ok: false, error: "Нет связи с сервером, попробуйте ещё раз" } as const;

/** Список отслеживаемых каналов: добавление, удаление и оповещение в Telegram о начале трансляции. Только для тех, у кого есть право. */
export function ChannelsManager({ channels, streams, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("");
  const [notify, setNotify] = useState(true);
  const [platform, setPlatform] = useState<MediaPlatform>("twitch");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const liveKeys = new Set(streams.map((stream) => channelKey(stream)));

  const run = (action: () => Promise<MediaActionResult>, success?: string, onDone?: () => void) => {
    startTransition(async () => {
      const result = await action().catch(() => NETWORK_ERROR);
      if (!result.ok) {
        toast.error(result.error);
        setError(result.error);
        return;
      }
      setError(null);
      if (result.warning) toast.warning(result.warning, { duration: 10_000 });
      else if (success) toast.success(success);
      onDone?.();
      onChanged();
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    run(
      () => addChannelAction({ channel, notify, platform }),
      "Канал добавлен",
      () => setChannel(""),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 aria-hidden="true" />
          Каналы
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Отслеживаемые каналы</DialogTitle>
          <DialogDescription>
            Трансляции этих каналов на Twitch и YouTube показываются в разделе, даже если в заголовке нет названия
            проекта. Для канала можно включить оповещение: бот напишет в Telegram, когда он начнёт эфир.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={platform}
            onValueChange={(value) => {
              // Повторное нажатие на выбранную площадку не должно снимать выбор
              if (value === "twitch" || value === "youtube") {
                setPlatform(value);
                setError(null);
              }
            }}
            aria-label="Площадка канала"
            className="self-start"
          >
            <ToggleGroupItem value="twitch">Twitch</ToggleGroupItem>
            <ToggleGroupItem value="youtube">YouTube</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex gap-2">
            <Input
              value={channel}
              onChange={(event) => {
                setChannel(event.target.value);
                setError(null);
              }}
              placeholder={
                platform === "twitch" ? "Логин или ссылка: twitch.tv/логин" : "Ссылка youtube.com/@имя или @имя"
              }
              aria-label={`Канал на ${platformLabels[platform]}`}
              aria-invalid={error ? true : undefined}
              maxLength={160}
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" disabled={pending || channel.trim() === ""}>
              <Plus aria-hidden="true" />
              Добавить
            </Button>
          </div>
          <Label className="flex items-center gap-2 font-normal text-sm">
            <Switch checked={notify} onCheckedChange={setNotify} aria-label="Оповещать о начале трансляции" />
            Оповещать в Telegram о начале трансляции
          </Label>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </form>

        <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-md border" aria-label="Список каналов">
          {channels.length === 0 && (
            <li className="px-3 py-6 text-center text-muted-foreground text-sm">Каналов пока нет</li>
          )}
          {channels.map((item) => (
            <li key={channelKey(item)} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-medium text-sm hover:underline"
                >
                  {item.name}
                </a>
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <span className="shrink-0">{platformLabels[item.platform]}</span>
                  {item.platform === "twitch" && <span className="truncate">{item.login}</span>}
                  {liveKeys.has(channelKey(item)) && (
                    <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-xs">
                      <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />в эфире
                    </Badge>
                  )}
                </div>
              </div>
              <Switch
                checked={item.notify}
                disabled={pending}
                onCheckedChange={(value) =>
                  run(
                    () => setChannelNotifyAction(item.login, value),
                    value ? "Оповещение включено" : "Оповещение выключено",
                  )
                }
                aria-label={`Оповещать о трансляции ${item.name}`}
                title="Оповещение в Telegram"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                onClick={() => run(() => removeChannelAction(item.login), "Канал удалён")}
                aria-label={`Удалить канал ${item.name}`}
                title="Удалить"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
