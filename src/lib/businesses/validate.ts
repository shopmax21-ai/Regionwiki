import { z } from "zod";

import { type Business, type BusinessCategory, categories } from "@/app/(main)/(dashboard)/business/_data/businesses";
import { isInsideWorld } from "@/app/(main)/(dashboard)/map/_components/map-data";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const businessCategories = categories.filter((item): item is BusinessCategory => item !== "Все");

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

const location = z.preprocess(
  emptyToUndefined,
  z
    .object({ x: z.number().finite(), y: z.number().finite() })
    .refine((point) => isInsideWorld(point))
    .optional(),
);

export const businessSchema = z.object({
  category: z.enum(businessCategories as [BusinessCategory, ...BusinessCategory[]]),
  id: z.number().int().min(1).max(999_999),
  price: z.number().int().min(0).max(10_000_000_000),
  imageUrl,
  location,
});

const fieldLabels: Record<string, string> = {
  category: "Тип бизнеса",
  id: "Номер",
  price: "Гос. стоимость",
  imageUrl: "Фото",
  location: "Место на карте",
};

export type BusinessValidation = { ok: true; business: Business } | { ok: false; error: string };

/** Проверяет данные бизнеса с клиента. Лишние поля отбрасываются. */
export function validateBusiness(input: unknown): BusinessValidation {
  const result = businessSchema.safeParse(input);
  if (result.success) return { ok: true, business: result.data as Business };
  const field = String(result.error.issues[0]?.path[0] ?? "");
  return { ok: false, error: `Проверьте поле «${fieldLabels[field] ?? field}»` };
}
