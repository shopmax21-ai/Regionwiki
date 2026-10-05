"use client";

import { cn } from "cn";
import { ImagePlus, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { IMAGE_ACCEPT } from "../../jobs/_components/upload-image";
import { useImageDrop } from "../../jobs/_components/use-image-drop";

type ItemImageFieldProps = {
  value: string;
  onChange: (url: string) => void;
  /** Слушать вставку и перетаскивание на уровне всей страницы: включайте, пока открыто окно редактора. */
  active: boolean;
  disabled?: boolean;
};

/**
 * Загрузка картинки предмета тремя способами: перетащить файл в окно, нажать и выбрать файл,
 * вставить скриншот или скопированную картинку через Ctrl+V.
 */
export function ItemImageField({ value, onChange, active, disabled = false }: ItemImageFieldProps) {
  const { inputRef, uploading, dragging, busy, error, setError, pick, onInputChange } = useImageDrop({
    onChange,
    active,
    disabled,
  });

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
            onClick={pick}
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
        onChange={onInputChange}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={pick} disabled={busy}>
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
