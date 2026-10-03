"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { type Realty, realtyTitle } from "../_data/realties";

function PhotoButton({ label, src, realty }: { label: string; src: string; realty: Realty }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{realtyTitle(realty)}</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          <Image
            src={src}
            alt={`${realtyTitle(realty)} — ${label.toLowerCase()}`}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            unoptimized
            className="object-cover"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Кнопки «Экстерьер» и «Интерьер» — показываются только для объектов с фотографиями. */
export function RealtyPhotos({ realty }: { realty: Realty }) {
  return (
    <div className="flex flex-wrap gap-2">
      {realty.exteriorUrl && <PhotoButton label="Экстерьер" src={realty.exteriorUrl} realty={realty} />}
      {realty.interiorUrl && <PhotoButton label="Интерьер" src={realty.interiorUrl} realty={realty} />}
    </div>
  );
}
