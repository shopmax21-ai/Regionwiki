"use client";

import { useRef, useState } from "react";

import { cn } from "cn";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { JOB_LIMITS } from "../_data/jobs";
import { IMAGE_ACCEPT, isImageFile, uploadImage } from "./upload-image";

/** Обложка работы 16:9: файл можно выбрать, перетащить сюда или указать ссылкой. */
export function JobCoverField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);

  const upload = async (files: File[]) => {
    const file = files.find(isImageFile);
    if (!file) {
      toast.error("Подходят только PNG, JPEG, WebP и GIF");
      return;
    }
    setUploading(true);
    try {
      onChange(await uploadImage(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить картинку");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Обложка</Label>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) void upload(files);
        }}
      />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: зона перетаскивания файла, не интерактивный элемент */}
      <div
        data-cover-drop
        role="presentation"
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setOver(false);
          void upload(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          "relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 text-center text-muted-foreground text-xs transition-colors",
          over && "border-primary bg-primary/5",
        )}
      >
        {value ? (
          // biome-ignore lint/performance/noImgElement: обложка может быть любой ссылкой, размеры заранее неизвестны
          <img src={value} alt="" className={cn("size-full object-cover", uploading && "opacity-50")} />
        ) : (
          <span className="flex flex-col items-center gap-1 px-3">
            <ImagePlus className="size-5" aria-hidden="true" />
            Перетащите картинку сюда
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 text-foreground text-sm">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Загрузка…
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          maxLength={JOB_LIMITS.image}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ссылка https:// или путь /images/..."
          autoComplete="off"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Выбрать файл обложки"
          onClick={() => input.current?.click()}
        >
          <ImagePlus />
        </Button>
        {value && (
          <Button type="button" variant="outline" size="icon" aria-label="Убрать обложку" onClick={() => onChange("")}>
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}
