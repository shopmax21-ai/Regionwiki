import { z } from "zod";

import { DEFAULT_EVENT_COLOR, isEventColor, EVENT_LIMITS as L } from "./types";

const instant = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Укажите корректную дату и время")
  .transform((value) => new Date(value));

const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Введите название мероприятия").max(L.title, "Название слишком длинное"),
    description: z.string().trim().max(L.description, "Описание слишком длинное").default(""),
    location: z.string().trim().max(L.location, "Место слишком длинное").default(""),
    startsAt: instant,
    endsAt: instant,
    color: z
      .string()
      .refine(isEventColor, "Выберите цвет мероприятия")
      .transform((value) => value.toLowerCase())
      .default(DEFAULT_EVENT_COLOR),
    notify: z.boolean().default(true),
    /** Сохранить, несмотря на пересечение с другими мероприятиями */
    force: z.boolean().default(false),
  })
  .superRefine((event, ctx) => {
    // Если дата не разобралась, её ошибка уже записана, а здесь значение остаётся строкой: сравнивать нечего
    if (!(event.startsAt instanceof Date) || !(event.endsAt instanceof Date)) return;
    const span = event.endsAt.getTime() - event.startsAt.getTime();
    if (span <= 0) ctx.addIssue({ code: "custom", message: "Окончание должно быть позже начала", path: ["endsAt"] });
    else if (span > L.maxDurationHours * 3_600_000) {
      ctx.addIssue({ code: "custom", message: "Мероприятие не может длиться больше недели", path: ["endsAt"] });
    }
  });

export type EventInput = {
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  color: string;
  notify: boolean;
  force: boolean;
};

export function validateEvent(input: unknown): { ok: true; event: EventInput } | { ok: false; error: string } {
  const result = eventSchema.safeParse(input);
  if (result.success) return { ok: true, event: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "Проверьте заполнение формы" };
}
