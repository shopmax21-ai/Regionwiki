import { z } from "zod";

import { fuelTypes, type Vehicle, vehicleCategories } from "@/app/(main)/(dashboard)/transport/_data/vehicles";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const money = z.number().int().min(0).max(10_000_000_000);
const optionalText = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const upgradeLevel = z.object({
  price: money,
  bonus: optionalText(80),
});

const upgrade = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(""),
  levels: z.array(upgradeLevel).min(1).max(10),
});

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

export const vehicleSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,48}$/),
  name: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  category: z.enum(vehicleCategories),
  speed: z.number().int().min(0).max(1000),
  tunedSpeed: z.number().int().min(0).max(1000),
  price: z.number().int().min(1).max(10_000_000_000),
  scrapPrice: z.preprocess(emptyToUndefined, money.optional()),
  sources: z.array(z.string().trim().min(1).max(60)).max(20),
  fuel: z.enum(fuelTypes),
  trunkKg: z.number().int().min(0).max(100_000),
  loadTons: z.preprocess(emptyToUndefined, z.number().min(0).max(1000).optional()),
  transferable: z.boolean(),
  driftChip: z.boolean(),
  nitro: z.boolean(),
  isNew: z.boolean().optional(),
  imageUrl,
  upgrades: z.array(upgrade).max(20).optional(),
});

const fieldLabels: Record<string, string> = {
  code: "Код (адрес страницы)",
  name: "Название",
  model: "Модель",
  category: "Категория",
  speed: "Скорость",
  tunedSpeed: "Скорость в тюнинге",
  price: "Гос. стоимость",
  scrapPrice: "Стоимость свалки",
  sources: "Источники",
  fuel: "Топливо",
  trunkKg: "Багажник",
  loadTons: "Грузоподъёмность",
  imageUrl: "Картинка",
  upgrades: "Улучшения",
};

export type ValidationResult = { ok: true; vehicle: Vehicle } | { ok: false; error: string };

/** Проверяет данные транспорта с клиента. Лишние поля отбрасываются. */
export function validateVehicle(input: unknown): ValidationResult {
  const result = vehicleSchema.safeParse(input);
  if (result.success) return { ok: true, vehicle: result.data as Vehicle };

  const field = String(result.error.issues[0]?.path[0] ?? "");
  return { ok: false, error: `Проверьте поле «${fieldLabels[field] ?? field}»` };
}
