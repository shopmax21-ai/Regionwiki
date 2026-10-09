import { z } from "zod";

import { BUG_LIMITS } from "./types";

export const bugSchema = z.object({
  title: z.string().trim().min(3, "Коротко опишите проблему").max(BUG_LIMITS.title, "Заголовок слишком длинный"),
  description: z
    .string()
    .trim()
    .min(10, "Опишите, что пошло не так, хотя бы в паре слов")
    .max(BUG_LIMITS.description, "Описание слишком длинное"),
  // Только путь внутри сайта: полный адрес и чужие домены не принимаются
  pagePath: z
    .string()
    .trim()
    .max(300)
    .transform((value) => (value.startsWith("/") && !value.startsWith("//") ? value : "/")),
});

export type BugInput = z.infer<typeof bugSchema>;

export function validateBug(input: unknown): { ok: true; bug: BugInput } | { ok: false; error: string } {
  const result = bugSchema.safeParse(input);
  if (result.success) return { ok: true, bug: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "Проверьте заполнение формы" };
}
