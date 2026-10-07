import { z } from "zod";

import { JOB_LIMITS, RESERVED_JOB_SLUGS } from "@/app/(main)/(dashboard)/jobs/_data/jobs";
import { SLUG_PATTERN } from "@/app/(main)/(dashboard)/jobs/_data/slug";
import {
  isPlaceIconImage,
  isPlaceIconPreset,
  MAP_WORLD,
  PLACE_LIMITS,
  placeCategoryIds,
} from "@/app/(main)/(dashboard)/map/_components/map-data";

const line = z.string().trim().min(1).max(JOB_LIMITS.item, "Один из пунктов слишком длинный");
const lines = z.array(line).max(JOB_LIMITS.items, `Не больше ${JOB_LIMITS.items} пунктов в списке`);

const imageSrc = z
  .string()
  .trim()
  .min(1, "У картинки нет адреса")
  .max(JOB_LIMITS.image, "Ссылка на картинку слишком длинная")
  .regex(/^(\/(?!\/)|https:\/\/)/, "Картинка: путь вида /api/jobs/images/... или ссылка https://");

const blockText = z
  .string()
  .trim()
  .min(1, "Один из блоков пустой")
  .max(JOB_LIMITS.blockText, "Текст блока слишком длинный");

const mapCoordinate = (label: string, min: number, max: number) =>
  z
    .number({ error: `Укажите координату ${label} у места на карте` })
    .min(min, `Координата ${label} вне карты`)
    .max(max, `Координата ${label} вне карты`);

const mapPlaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "У места на карте нет названия")
    .max(JOB_LIMITS.placeName, "Название места слишком длинное"),
  x: mapCoordinate("X", MAP_WORLD.minX, MAP_WORLD.maxX),
  y: mapCoordinate("Y", MAP_WORLD.minY, MAP_WORLD.maxY),
  category: z.enum(placeCategoryIds, { error: "Выберите категорию места" }),
  icon: z
    .string()
    .trim()
    .max(PLACE_LIMITS.icon, "Ссылка на иконку слишком длинная")
    .refine(
      (value) => value === "" || isPlaceIconPreset(value) || isPlaceIconImage(value),
      "Иконка: выберите готовую или загрузите свою картинку",
    )
    .optional()
    .transform((value) => (value ? value : undefined)),
  description: z
    .string()
    .trim()
    .max(JOB_LIMITS.placeDescription, "Описание места слишком длинное")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: blockText.max(JOB_LIMITS.sectionTitle, "Заголовок слишком длинный") }),
  z.object({ type: z.literal("text"), text: blockText }),
  z.object({
    type: z.literal("list"),
    ordered: z.boolean(),
    items: z
      .array(line)
      .min(1, "В списке нет ни одного пункта")
      .max(JOB_LIMITS.listItems, `Не больше ${JOB_LIMITS.listItems} пунктов в списке`),
  }),
  z.object({ type: z.literal("callout"), variant: z.enum(["tip", "info", "warning"]), text: blockText }),
  z.object({
    type: z.literal("image"),
    src: imageSrc,
    caption: z
      .string()
      .trim()
      .max(JOB_LIMITS.caption, "Подпись к картинке слишком длинная")
      .optional()
      .transform((value) => (value ? value : undefined)),
  }),
  z.object({
    type: z.literal("slider"),
    slides: z
      .array(
        z.object({
          src: imageSrc,
          caption: z
            .string()
            .trim()
            .max(JOB_LIMITS.caption, "Подпись к слайду слишком длинная")
            .optional()
            .transform((value) => (value ? value : undefined)),
        }),
      )
      .min(1, "В слайдере должен быть хотя бы один слайд")
      .max(JOB_LIMITS.sliderSlides, `Не больше ${JOB_LIMITS.sliderSlides} слайдов в одном слайдере`),
  }),
  z.object({
    type: z.literal("textImage"),
    side: z.enum(["left", "right"]),
    // Текст и картинка необязательны по отдельности: пустые блоки редактор отбрасывает сам
    text: z.string().trim().max(JOB_LIMITS.blockText, "Текст блока слишком длинный"),
    src: imageSrc.optional(),
    caption: z
      .string()
      .trim()
      .max(JOB_LIMITS.caption, "Подпись к картинке слишком длинная")
      .optional()
      .transform((value) => (value ? value : undefined)),
  }),
  z.object({
    type: z.literal("map"),
    title: z
      .string()
      .trim()
      .max(JOB_LIMITS.mapTitle, "Заголовок карты слишком длинный")
      .optional()
      .transform((value) => (value ? value : undefined)),
    places: z
      .array(mapPlaceSchema)
      .min(1, "На карте должно быть хотя бы одно место")
      .max(JOB_LIMITS.mapPlaces, `Не больше ${JOB_LIMITS.mapPlaces} мест на одной карте`),
  }),
]);

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value ? value : undefined));

export const jobSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Укажите адрес гайда")
    .max(60, "Адрес слишком длинный")
    .regex(SLUG_PATTERN, "Адрес: латинские буквы, цифры и дефис, например voditel-avtobusa")
    .refine((value) => !RESERVED_JOB_SLUGS.includes(value), "Этот адрес занят, выберите другой"),
  title: z.string().trim().min(1, "Укажите название").max(JOB_LIMITS.title, "Название слишком длинное"),
  kind: z.enum(["legal", "illegal"], { message: "Выберите тип работы" }),
  level: z.coerce
    .number({ message: "Уровень должен быть числом" })
    .int("Уровень должен быть целым числом")
    .min(0, "Уровень не может быть отрицательным")
    .max(JOB_LIMITS.level, "Слишком большой уровень"),
  altRanks: z.array(z.string().trim().min(1)).max(2, "Не больше двух работ для альтернативного пути").default([]),
  tagline: z.string().trim().min(1, "Добавьте короткое описание").max(JOB_LIMITS.tagline, "Описание слишком длинное"),
  intro: z.string().trim().min(1, "Добавьте вводный абзац").max(JOB_LIMITS.intro, "Вводный абзац слишком длинный"),
  conditions: lines.default([]),
  income: lines.default([]),
  process: lines.default([]),
  tips: lines.default([]),
  teamwork: optionalText(JOB_LIMITS.teamwork, "Текст про совместную работу слишком длинный"),
  navigator: optionalText(JOB_LIMITS.navigator, "Подсказка навигатора слишком длинная"),
  image: optionalText(JOB_LIMITS.image, "Ссылка на картинку слишком длинная").refine(
    (value) => value === undefined || /^(\/(?!\/)|https:\/\/)/.test(value),
    "Картинка: путь вида /api/jobs/images/... или ссылка https://",
  ),
  sections: z
    .array(
      z.object({
        title: z
          .string()
          .trim()
          .min(1, "У раздела должен быть заголовок")
          .max(JOB_LIMITS.sectionTitle, "Заголовок раздела слишком длинный"),
        items: lines,
      }),
    )
    .max(JOB_LIMITS.sections, `Не больше ${JOB_LIMITS.sections} дополнительных разделов`)
    .default([]),
  /** Содержимое гайда из блочного редактора. Если передано, старые поля списков игнорируются при показе. */
  blocks: z.array(blockSchema).max(JOB_LIMITS.blocks, `Не больше ${JOB_LIMITS.blocks} блоков в гайде`).optional(),
});

export type JobInput = z.infer<typeof jobSchema>;

export function validateJob(input: unknown): { ok: true; job: JobInput } | { ok: false; error: string } {
  const result = jobSchema.safeParse(input);
  if (result.success) return { ok: true, job: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "Проверьте заполнение формы" };
}
