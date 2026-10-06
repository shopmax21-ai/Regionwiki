"use client";

import { useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ImagePrepareError, prepareImage } from "@/lib/image-resize.client";

// image/* вместо списка типов: на телефонах файл может прийти без типа или в HEIC, браузер всё равно его прочитает
const ACCEPT = "image/*";
/** Исходник до сжатия: фото с телефона бывают крупными, но совсем огромные файлы не читаем */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

const uploadError = (status: number, fallback?: string) => {
  if (status === 413) return "Картинка слишком большая, выберите другую";
  return fallback ?? "Не удалось загрузить фон";
};

/** Кнопки «Загрузить фон» и «Убрать фон» в углу блока профиля. Только для своего профиля. */
export function ProfileBackgroundControl({ hasBackground }: { hasBackground: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error("Файл слишком большой, выберите другое изображение");
      return;
    }

    setBusy(true);
    try {
      // Уменьшаем и пересохраняем в JPEG прямо в браузере: так загрузка проходит и с телефона
      let prepared: File;
      try {
        prepared = await prepareImage(file);
      } catch (error) {
        toast.error(
          error instanceof ImagePrepareError && error.code === "decode"
            ? "Не удалось прочитать картинку. Выберите JPEG, PNG, WebP или GIF"
            : "Не удалось подготовить картинку, выберите другую",
        );
        return;
      }

      const body = new FormData();
      body.append("file", prepared);
      const response = await fetch("/api/profile/background", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(uploadError(response.status, data?.error));
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
