"use client";

import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

function hintFor(reason: string | null, status: number): string {
  if (status === 401) return "Сессия устарела, войдите заново.";
  if (reason === "telegram-unreachable" || status === 502)
    return "Сервер не смог связаться с Telegram, попробуйте позже.";
  if (reason?.includes("приватности")) {
    return "Telegram не отдаёт боту ваше фото. Откройте Настройки → Конфиденциальность → Фотография профиля и выберите «Все».";
  }
  return reason ? `Фото не загрузилось: ${reason}` : "Фото не загрузилось.";
}

/**
 * Аватар из Telegram. Если фото не пришло, под именем показывается причина, а не просто инициалы.
 * userId — Telegram ID другого администратора: его фото отдаётся только администрации, а подсказки про
 * настройки приватности (они для владельца профиля) не показываются.
 */
export function ProfileAvatar({ name, userId }: { name: string; userId?: string }) {
  const [hint, setHint] = useState<string | null>(null);
  const src = userId ? `/api/auth/avatar?id=${encodeURIComponent(userId)}` : "/api/auth/avatar";

  const explain = async () => {
    if (userId) return;
    try {
      const response = await fetch(src, { cache: "no-store" });
      if (response.ok) return;
      const reason = response.headers.get("x-avatar-reason");
      setHint(hintFor(reason ? decodeURIComponent(reason) : null, response.status));
    } catch {
      setHint("Нет связи с сервером.");
    }
  };

  return (
    <>
      <Avatar className="size-16 rounded-xl">
        <AvatarImage
          src={src}
          alt={name}
          onLoadingStatusChange={(status) => {
            if (status === "error") void explain();
          }}
        />
        <AvatarFallback className="rounded-xl text-lg">{getInitials(name)}</AvatarFallback>
      </Avatar>
      {hint && <p className="basis-full text-muted-foreground text-xs">{hint}</p>}
    </>
  );
}
