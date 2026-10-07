import { z } from "zod";

import { REPLY_LIMITS } from "@/app/(main)/(dashboard)/replies/_data/replies";

export const replySchema = z.object({
  category: z.string().trim().min(1, "Укажите категорию").max(REPLY_LIMITS.category, "Категория слишком длинная"),
  title: z.string().trim().min(1, "Укажите название").max(REPLY_LIMITS.title, "Название слишком длинное"),
  text: z.string().trim().min(1, "Введите текст ответа").max(REPLY_LIMITS.text, "Текст слишком длинный"),
});

export type ReplyInput = z.infer<typeof replySchema>;

export function validateReply(input: unknown): { ok: true; reply: ReplyInput } | { ok: false; error: string } {
  const result = replySchema.safeParse(input);
  if (result.success) return { ok: true, reply: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "Проверьте заполнение формы" };
}
