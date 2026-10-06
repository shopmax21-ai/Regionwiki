"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "cn";

import { getInitials } from "@/lib/utils";

type PersonAvatarProps = {
  /** Telegram ID человека. Чужое фото сервер отдаёт только для администраторов */
  id: string;
  name: string;
  /** Размер и скругление, например "size-5 rounded-md" */
  className?: string;
};

/**
 * Аватар из Telegram для строк таблиц и списков.
 * Инициалы лежат под картинкой, поэтому фото появляется сразу, как только браузер его отдал из кэша,
 * а если фото нет (404), остаются инициалы без значка «битой» картинки
 */
export function PersonAvatar({ id, name, className }: PersonAvatarProps) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Ошибка могла случиться до гидратации, когда onError ещё не был подключён
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <span
      className={cn(
        "relative inline-flex size-5 shrink-0 select-none items-center justify-center overflow-hidden rounded-md bg-muted font-medium text-[0.55rem] text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden="true">{getInitials(name)}</span>
      {!failed && (
        // biome-ignore lint/performance/noImgElement: адрес отдаёт свой API с кэшем в браузере, оптимизатор Next не нужен
        <img
          ref={imageRef}
          src={`/api/auth/avatar?id=${encodeURIComponent(id)}`}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
