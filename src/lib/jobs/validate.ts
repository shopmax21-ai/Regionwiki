import { z } from "zod";

import { JOB_LIMITS } from "@/app/(main)/dashboard/jobs/_data/jobs";
import { SLUG_PATTERN } from "@/app/(main)/dashboard/jobs/_data/slug";

const line = z.string().trim().min(1).max(JOB_LIMITS.item, "Один из пунктов слишком длинный");
const lines = z.array(line).max(JOB_LIMITS.items, `Не больше ${JOB_LIMITS.items} пунктов в списке`);

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
    .regex(SLUG_PATTERN, "Адрес: латинские буквы, цифры и дефис, например voditel-avtobusa"),
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
    "Картинка: путь вида /images/jobs/name.webp или ссылка https://",
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
});

export type JobInput = z.infer<typeof jobSchema>;

export function validateJob(input: unknown): { ok: true; job: JobInput } | { ok: false; error: string } {
  const result = jobSchema.safeParse(input);
  if (result.success) return { ok: true, job: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "Проверьте заполнение формы" };
}
