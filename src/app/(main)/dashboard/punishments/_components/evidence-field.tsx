"use client";

import { type Dispatch, type SetStateAction, useState } from "react";

import { ExternalLink, ImagePlus, Link2, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type EvidenceItem, PUNISHMENT_LIMITS } from "@/lib/punishments/types";

import { IMAGE_ACCEPT } from "../../jobs/_components/upload-image";
import { useImageDrop } from "../../jobs/_components/use-image-drop";

type EvidenceFieldProps = {
  value: EvidenceItem[];
  setValue: Dispatch<SetStateAction<EvidenceItem[]>>;
  /** Слушать вставку и перетаскивание на уровне страницы */
  active: boolean;
  disabled?: boolean;
};

const isHttps = (text: string) => {
  try {
    return new URL(text).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Доказательства (необязательно): ссылки на видео и скриншоты или сами скриншоты. Скриншот можно вставить через Ctrl+V,
 * перетащить в окно или выбрать по нажатию.
 */
export function EvidenceField({ value, setValue, active, disabled = false }: EvidenceFieldProps) {
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const full = value.length >= PUNISHMENT_LIMITS.maxEvidence;
  const locked = disabled ? true : full;

  const addItem = (item: EvidenceItem) =>
    setValue((current) => {
      if (current.length >= PUNISHMENT_LIMITS.maxEvidence || current.some((existing) => existing.url === item.url)) {
        return current;
      }
      return [...current, item];
    });

  const { inputRef, uploading, dragging, error, pick, onInputChange } = useImageDrop({
    onChange: (url) => addItem({ type: "image", url }),
    active: active && !full,
    disabled: locked,
  });

  let dropLabel = "Вставьте скриншот через Ctrl+V, перетащите файл или нажмите, чтобы выбрать";
  if (uploading) dropLabel = "Загружаем скриншот...";
  else if (dragging) dropLabel = "Отпустите, чтобы загрузить";

  const addLink = () => {
    const text = link.trim();
    if (!text) return;
    if (!isHttps(text)) {
      setLinkError("Ссылка должна начинаться с https://");
      return;
    }
    setLinkError(null);
    addItem({ type: "link", url: text });
    setLink("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={link}
          disabled={locked}
          maxLength={PUNISHMENT_LIMITS.linkMax}
          aria-invalid={Boolean(linkError)}
          placeholder="Ссылка на видео или скриншот: https://..."
          onChange={(event) => {
            setLinkError(null);
            setLink(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addLink();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addLink} disabled={locked || link.trim() === ""}>
          <Link2 data-icon="inline-start" />
          Добавить
        </Button>
      </div>
      {linkError && (
        <p role="alert" className="-mt-2 text-destructive text-xs">
          {linkError}
        </p>
      )}

      <button
        type="button"
        onClick={pick}
        disabled={locked || uploading}
        className={`flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-center text-muted-foreground text-xs outline-none transition-colors hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${dragging ? "border-primary bg-primary/10 text-primary" : ""}`}
      >
        {uploading ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ImagePlus className="size-4" aria-hidden="true" />
        )}
        {dropLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={onInputChange}
      />
      {error && (
        <p role="alert" className="-mt-2 text-destructive text-xs">
          {error}
        </p>
      )}

      {value.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {value.map((item) => (
            <li key={item.url} className="flex items-center gap-2 rounded-lg border p-1.5 pr-2">
              {item.type === "image" ? (
                <a href={item.url} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* biome-ignore lint/performance/noImgElement: превью загруженного скриншота */}
                  <img src={item.url} alt="Скриншот" className="size-10 rounded object-cover" />
                </a>
              ) : (
                <ExternalLink className="mx-2 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs">
                {item.type === "image" ? (
                  "Скриншот"
                ) : (
                  <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {item.url.replace(/^https:\/\//, "")}
                  </a>
                )}
              </span>
              <button
                type="button"
                aria-label="Убрать доказательство"
                disabled={disabled}
                className="rounded-sm p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setValue((current) => current.filter((existing) => existing.url !== item.url))}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-xs">
        Необязательно. Если доказательств нет, администратор выдаст наказание без проверки. До{" "}
        {PUNISHMENT_LIMITS.maxEvidence} штук.
      </p>
    </div>
  );
}
