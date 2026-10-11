import { z } from "zod";

import { MEDIA_PR_LIMITS, type MediaPrInput, mediaPrPlatforms, mediaPrStatuses } from "./types";

/** Ссылка только http(s): так в таблицу не попадёт javascript: и подобное. Без схемы добавляем https://. */
function normalizeUrl(value: string): string | null {
  const text = value.trim();
  if (!text) return "";
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const audience = z.union([z.number(), z.string(), z.null()]).transform((value, ctx) => {
  if (value === null || (typeof value === "string" && value.trim() === "")) return null;
  const number = typeof value === "number" ? value : Number(value.replace(/\s/g, ""));
  if (!Number.isInteger(number) || number < 0 || number > MEDIA_PR_LIMITS.audienceMax) {
    ctx.addIssue({ code: "custom", message: "Аудитория: целое число от 0" });
    return z.NEVER;
  }
  return number;
});

export const mediaPrSchema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(MEDIA_PR_LIMITS.name, "Название слишком длинное"),
  platform: z.enum(mediaPrPlatforms, { error: "Выберите площадку" }),
  url: z.string().max(MEDIA_PR_LIMITS.url, "Ссылка слишком длинная").default(""),
  contact: z.string().trim().max(MEDIA_PR_LIMITS.contact, "Контакты слишком длинные").default(""),
  audience: audience.default(null),
  status: z.enum(mediaPrStatuses, { error: "Выберите статус" }),
  note: z.string().trim().max(MEDIA_PR_LIMITS.note, "Заметка слишком длинная").default(""),
});

export function validateMediaPr(input: unknown): { ok: true; entry: MediaPrInput } | { ok: false; error: string } {
  const result = mediaPrSchema.safeParse(input);
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? "Проверьте заполнение формы" };
  const url = normalizeUrl(result.data.url);
  if (url === null) return { ok: false, error: "Ссылка должна быть адресом сайта, например https://twitch.tv/имя" };
  return { ok: true, entry: { ...result.data, url } };
}

export function validateMediaPrInfo(input: unknown): { ok: true; text: string } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: false, error: "Неверный текст" };
  const text = input.replace(/\r\n/g, "\n").trim();
  if (text.length > MEDIA_PR_LIMITS.info) return { ok: false, error: "Текст справки слишком длинный" };
  return { ok: true, text };
}
