"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "cn";
import { ImagePlus, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { IMAGE_ACCEPT, isImageFile, uploadImage } from "../../jobs/_components/upload-image";

type ItemImageFieldProps = {
  value: string;
  onChange: (url: string) => void;
  /** Слушать вставку и перетаскивание на уровне всей страницы: включайте, пока открыто окно редактора. */
  active: boolean;
  disabled?: boolean;
};

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

/** Первая картинка из буфера обмена (скриншот или скопированный файл) или null. */
function imageFromClipboard(event: ClipboardEvent): File | null {
  const files = Array.from(event.clipboardData?.files ?? []);
  const fromFiles = files.find(isImageFile);
  if (fromFiles) return fromFiles;

  for (const entry of Array.from(event.clipboardData?.items ?? [])) {
    if (entry.kind === "file" && entry.type.startsWith("image/")) {
      const file = entry.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

/**
 * Загрузка картинки предмета тремя способами: перетащить файл в окно, нажать и выбрать файл,
 * вставить скриншот или скопированную картинку через Ctrl+V.
 */
export function ItemImageField({ value, onChange, active, disabled = false }: ItemImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = uploading || disabled;

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        onChange(await uploadImage(file));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить картинку");
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  // Обработчики держим в ref, чтобы слушатели окна не пересоздавались при каждом вводе в форму
  const uploadRef = useRef(upload);
  const busyRef = useRef(busy);
  useEffect(() => {
    uploadRef.current = upload;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!active) return;

    let depth = 0;

    const onPaste = (event: ClipboardEvent) => {
      const file = imageFromClipboard(event);
      // Обычный текст в поля формы вставляется как раньше
      if (!file) return;
      event.preventDefault();
      if (!busyRef.current) void uploadRef.current(file);
    };

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth++;
      setDragging(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    // Без preventDefault браузер открыл бы брошенный файл вместо загрузки
    const onDragOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      if (busyRef.current) return;

      const files = Array.from(event.dataTransfer?.files ?? []);
      const file = files.find(isImageFile);
      if (file) void uploadRef.current(file);
      else if (files.length > 0) setError("Подходят только PNG, JPEG, WebP и GIF");
    };

    document.addEventListener("paste", onPaste);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      setDragging(false);
    };
  }, [active]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/30 transition-colors",
          dragging && "border-primary bg-primary/5",
          !dragging && "border-input",
        )}
      >
        {value ? (
          // Размер заранее неизвестен, адрес может быть внешним, поэтому обычный img
          // biome-ignore lint/performance/noImgElement: превью загруженной или внешней картинки без оптимизации
          <img src={value} alt="Картинка предмета" className="size-full object-contain p-4" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex size-full flex-col items-center justify-center gap-1.5 px-4 text-center text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
          >
            <ImagePlus className="size-8 stroke-[1.5]" aria-hidden="true" />
            <span className="font-medium text-foreground text-sm">Перетащите картинку сюда</span>
            <span className="text-xs">или нажмите, чтобы выбрать файл, или вставьте через Ctrl+V</span>
          </button>
        )}

        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70 font-medium text-primary text-sm">
            Отпустите, чтобы загрузить
          </div>
        )}

        {uploading && (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm backdrop-blur-[1px]"
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Загружаем...
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          <ImagePlus data-icon="inline-start" /> {value ? "Заменить" : "Выбрать файл"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              setError(null);
              onChange("");
            }}
            disabled={busy}
          >
            <X data-icon="inline-start" /> Убрать картинку
          </Button>
        )}
        <span className="text-muted-foreground text-xs">PNG, JPEG, WebP или GIF до 5 МБ</span>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
