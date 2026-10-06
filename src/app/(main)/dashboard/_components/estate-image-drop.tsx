"use client";

import { cn } from "cn";
import { ImagePlus, LoaderCircle, type LucideIcon, Replace, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { IMAGE_ACCEPT } from "../jobs/_components/upload-image";
import { useImageDrop } from "../jobs/_components/use-image-drop";

type EstateImageDropProps = {
  value: string;
  onChange: (url: string) => void;
  /** Иконка-заглушка, пока картинки нет */
  icon: LucideIcon;
  alt: string;
  /** Слушать вставку и перетаскивание на уровне всей страницы: включайте, пока открыто окно редактора. */
  active: boolean;
  disabled?: boolean;
};

/**
 * Картинка в карточке-предпросмотре, в которую её можно загрузить: перетащить файл, нажать и выбрать
 * или вставить через Ctrl+V. Нужна бизнесам и недвижимости.
 */
export function EstateImageDrop({ value, onChange, icon: Icon, alt, active, disabled = false }: EstateImageDropProps) {
  const { inputRef, uploading, dragging, busy, error, setError, pick, onInputChange } = useImageDrop({
    onChange,
    active,
    disabled,
  });

  return (
    <div
      className={cn(
        "group/drop relative aspect-[16/9] overflow-hidden border-b bg-gradient-to-b from-muted/70 to-muted/20 transition-colors",
        dragging && "bg-primary/10",
      )}
    >
      {value ? (
        <>
          {/* biome-ignore lint/performance/noImgElement: адрес может быть внешним, размер неизвестен, оптимизация не нужна */}
          <img src={value} alt={alt} className="size-full object-cover" />
          <div className="absolute inset-0 flex items-end justify-center gap-2 bg-gradient-to-t from-background/80 via-transparent to-transparent p-2 opacity-100 transition-opacity md:opacity-0 md:group-hover/drop:opacity-100 md:focus-within:opacity-100">
            <Button type="button" size="xs" variant="secondary" onClick={pick} disabled={busy}>
              <Replace data-icon="inline-start" /> Заменить
            </Button>
            <Button
              type="button"
              size="xs"
              variant="secondary"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setError(null);
                onChange("");
              }}
              disabled={busy}
            >
              <X data-icon="inline-start" /> Убрать
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="flex size-full flex-col items-center justify-center gap-1 px-4 text-center text-muted-foreground outline-none transition-colors hover:bg-primary/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:pointer-events-none"
        >
          <Icon className="size-10 stroke-[1] text-muted-foreground/40" aria-hidden="true" />
          <span className="mt-1 flex items-center gap-1.5 font-medium text-foreground text-sm">
            <ImagePlus className="size-4" aria-hidden="true" /> Добавить картинку
          </span>
          <span className="text-xs leading-4">
            Перетащите файл, нажмите, чтобы выбрать, или вставьте через{" "}
            <kbd className="rounded border bg-background px-1 font-sans text-[10px]">Ctrl</kbd>+
            <kbd className="rounded border bg-background px-1 font-sans text-[10px]">V</kbd>
          </span>
        </button>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border-2 border-primary border-dashed bg-background/80 font-medium text-primary text-sm">
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

      {error && (
        <p
          role="alert"
          className="absolute inset-x-0 bottom-0 bg-destructive px-3 py-1.5 text-center text-destructive-foreground text-xs"
        >
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={onInputChange}
      />
    </div>
  );
}
