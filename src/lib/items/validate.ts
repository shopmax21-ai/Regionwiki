import { z } from "zod";

import { defaultItemFlags, type Item, isItemCategory, itemFlagDefs } from "@/app/(main)/dashboard/items/_data/items";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

/** Локальный путь (/api/jobs/images/...) или https-ссылка. */
const imageUrl = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(500)
    .regex(/^(\/(?!\/)|https:\/\/)\S+$/)
    .optional(),
);

const optionalText = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const flags = z
  .object(Object.fromEntries(itemFlagDefs.map((def) => [def.key, z.boolean()])) as Record<string, z.ZodBoolean>)
  .default(defaultItemFlags);

export const itemSchema = z.object({
  /** Не указан — сервер выдаст следующий свободный номер. При изменении предмета не используется. */
  id: z.preprocess(emptyToUndefined, z.number().int().min(1).max(2_000_000_000).optional()),
  name: z.string().trim().min(1).max(80),
  category: z.custom<Item["category"]>(isItemCategory),
  imageUrl,
  description: optionalText(300),
  weight: z.preprocess(emptyToUndefined, z.number().min(0).max(100_000).optional()),
  obtain: optionalText(300),
  flags,
});

export type ItemInput = z.infer<typeof itemSchema>;

const fieldLabels: Record<string, string> = {
  id: "ID",
  name: "Название",
  category: "Категория",
  imageUrl: "Картинка",
  description: "Описание",
  weight: "Вес",
  obtain: "Где можно получить",
  flags: "Свойства",
};

export type ItemValidationResult = { ok: true; item: ItemInput } | { ok: false; error: string };

/** Проверяет данные предмета с клиента. Лишние поля отбрасываются. */
export function validateItem(input: unknown): ItemValidationResult {
  const result = itemSchema.safeParse(input);
  if (result.success) return { ok: true, item: result.data };

  const field = String(result.error.issues[0]?.path[0] ?? "");
  return { ok: false, error: `Проверьте поле «${fieldLabels[field] ?? field}»` };
}
