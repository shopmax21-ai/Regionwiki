import { z } from "zod";

import { categories, type Realty, type RealtyCategory } from "@/app/(main)/dashboard/real-estate/_data/realties";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const realtyCategories = categories.filter((item): item is RealtyCategory => item !== "Все");

/** Локальный путь (/images/...) или https-ссылка. */
const imageUrl = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(500)
    .regex(/^(\/(?!\/)|https:\/\/)\S+$/)
    .optional(),
);

export const realtySchema = z.object({
  id: z.number().int().min(1).max(9_999_999),
  category: z.enum(realtyCategories as [RealtyCategory, ...RealtyCategory[]]),
  price: z.number().int().min(0).max(10_000_000_000),
  residents: z.number().int().min(0).max(1000),
  garage: z.number().int().min(0).max(1000),
  exteriorUrl: imageUrl,
  interiorUrl: imageUrl,
});

const fieldLabels: Record<string, string> = {
  id: "Номер",
  category: "Тип недвижимости",
  price: "Гос. стоимость",
  residents: "Жильцов",
  garage: "Гаражных мест",
  exteriorUrl: "Фото экстерьера",
  interiorUrl: "Фото интерьера",
};

export type RealtyValidation = { ok: true; realty: Realty } | { ok: false; error: string };

/** Проверяет данные недвижимости с клиента. Лишние поля отбрасываются. */
export function validateRealty(input: unknown): RealtyValidation {
  const result = realtySchema.safeParse(input);
  if (result.success) return { ok: true, realty: result.data as Realty };
  const field = String(result.error.issues[0]?.path[0] ?? "");
  return { ok: false, error: `Проверьте поле «${fieldLabels[field] ?? field}»` };
}
