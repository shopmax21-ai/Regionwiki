import { z } from "zod";

import {
  isInsideWorld,
  isPlaceIconImage,
  isPlaceIconPreset,
  MAP_WORLD,
  PLACE_LIMITS,
  type PlaceCategoryId,
  placeCategoryIds,
} from "@/app/(main)/dashboard/map/_components/map-data";

const coordinate = (label: string, min: number, max: number) =>
  z
    .number({ error: `Укажите координату ${label}` })
    .min(min, `Координата ${label} вне карты`)
    .max(max, `Координата ${label} вне карты`);

export const placeSchema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(PLACE_LIMITS.name, "Название слишком длинное"),
  category: z.enum(placeCategoryIds, { error: "Выберите категорию" }),
  x: coordinate("X", MAP_WORLD.minX, MAP_WORLD.maxX),
  y: coordinate("Y", MAP_WORLD.minY, MAP_WORLD.maxY),
  description: z.string().trim().max(PLACE_LIMITS.description, "Описание слишком длинное").default(""),
  /** Пусто — иконка категории; иначе id готовой иконки или адрес своей картинки */
  icon: z
    .string()
    .trim()
    .max(PLACE_LIMITS.icon, "Ссылка на иконку слишком длинная")
    .refine(
      (value) => value === "" || isPlaceIconPreset(value) || isPlaceIconImage(value),
      "Иконка: выберите готовую или загрузите свою картинку",
    )
    .default(""),
});

export type PlaceInput = {
  name: string;
  category: PlaceCategoryId;
  x: number;
  y: number;
  description: string;
  icon: string;
};

export function validatePlace(input: unknown): { ok: true; place: PlaceInput } | { ok: false; error: string } {
  const result = placeSchema.safeParse(input);
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? "Проверьте заполнение формы" };
  const place = result.data;
  if (!isInsideWorld(place)) return { ok: false, error: "Метка должна быть в пределах карты" };
  // Координаты храним с точностью до сотых: этого достаточно, а лишние знаки только шумят в интерфейсе.
  return { ok: true, place: { ...place, x: Math.round(place.x * 100) / 100, y: Math.round(place.y * 100) / 100 } };
}
