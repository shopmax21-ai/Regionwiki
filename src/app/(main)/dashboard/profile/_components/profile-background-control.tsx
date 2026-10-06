"use client";

import { useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const TYPES = new Set(ACCEPT.split(","));
const MAX_BYTES = 5 * 1024 * 1024;

/** Кнопки «Загрузить фон» и «Убрать фон» в углу блока профиля. Только для своего профиля. */
export function ProfileBackgroundControl({ hasBackground }: { hasBackground: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (!TYPES.has(file.type)) {
      toast.error("Подходят только PNG, JPEG, WebP и GIF");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Картинка больше 5 МБ, уменьшите её");
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/profile/background", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(data?.error ?? "Не удалось загрузить фон");
        return;
      }
      toast.success("Фон профиля обновлён");
      router.refresh();
    } catch {
      toast.error("Нет связи с сервером, попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/profile/background", { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(data?.error ?? "Не удалось убрать фон");
        return;
      }
      toast.success("Фон профиля убран");
      router.refresh();
    } catch {
      toast.error("Нет связи с сервером, попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute top-3 right-12 z-10 flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Сбрасываем выбор, чтобы можно было загрузить тот же файл повторно
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        className="bg-background/70 backdrop-blur-sm"
        title={hasBackground ? "Сменить фон" : "Загрузить фон"}
        aria-label={hasBackground ? "Сменить фон профиля" : "Загрузить фон профиля"}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
      </Button>
      {hasBackground && (
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          className="bg-background/70 backdrop-blur-sm hover:text-destructive"
          title="Убрать фон"
          aria-label="Убрать фон профиля"
          disabled={busy}
          onClick={() => void remove()}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );
}
