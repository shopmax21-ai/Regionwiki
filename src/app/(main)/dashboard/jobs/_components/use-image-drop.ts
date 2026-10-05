"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isImageFile, uploadImage } from "./upload-image";

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

type UseImageDropOptions = {
  onChange: (url: string) => void;
  /** Слушать вставку и перетаскивание на уровне всей страницы: включайте, пока открыто окно редактора. */
  active: boolean;
  disabled?: boolean;
};

/**
 * Загрузка картинки тремя способами: перетащить файл в окно, выбрать файл через окно выбора, вставить скриншот
 * или скопированную картинку через Ctrl+V. Возвращает состояние для интерфейса и поле выбора файла (inputProps).
 */
export function useImageDrop({ onChange, active, disabled = false }: UseImageDropOptions) {
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

  return {
    inputRef,
    uploading,
    dragging,
    busy,
    error,
    setError,
    /** Открыть окно выбора файла */
    pick: () => inputRef.current?.click(),
    /** Выбранный в окне файл загружается сразу, поле очищается, чтобы тот же файл можно было выбрать снова */
    onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void upload(file);
    },
  };
}
