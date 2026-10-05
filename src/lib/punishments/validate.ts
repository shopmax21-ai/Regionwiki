import { z } from "zod";

import { type EvidenceItem, PUNISHMENT_LIMITS as L } from "./types";

/** «ОП 4.9», «ГС 1.2»: тег статьи и номер пункта. Регистр тега и пробелы приводятся к единому виду. */
const RULE_PATTERN = /^([A-Za-zА-Яа-яЁё]{1,10})\s*(\d{1,3}(?:\.\d{1,3}){0,3})$/;

export function normalizeRuleLabel(value: string): string | null {
  const match = RULE_PATTERN.exec(value.trim());
  return match ? `${match[1].toUpperCase()} ${match[2]}` : null;
}

const IMAGE_PATH = /^\/api\/jobs\/images\/[A-Za-z0-9_-]{8,128}$/;

const evidenceItem = z
  .object({ type: z.enum(["link", "image"]), url: z.string().trim().min(1).max(L.linkMax) })
  .superRefine((item, ctx) => {
    if (item.type === "image") {
      if (!IMAGE_PATH.test(item.url)) ctx.addIssue({ code: "custom", message: "Некорректный скриншот", path: ["url"] });
      return;
    }
    try {
      const url = new URL(item.url);
      if (url.protocol !== "https:") throw new Error("not https");
    } catch {
      ctx.addIssue({ code: "custom", message: "Ссылка должна начинаться с https://", path: ["url"] });
    }
  });

const requestSchema = z.object({
  staticId: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{1,${L.staticMaxDigits}}$`), "Статик состоит из цифр"),
  minutes: z
    .number("Укажите время наказания в минутах")
    .int("Время указывается целым числом минут")
    .min(L.minMinutes, `Время от ${L.minMinutes} мин`)
    .max(L.maxMinutes, `Время не больше ${L.maxMinutes} мин`),
  rules: z
    .array(z.string())
    .min(1, "Укажите хотя бы один пункт правил")
    .max(L.maxRules, `Не больше ${L.maxRules} пунктов правил`),
  evidence: z.array(evidenceItem).max(L.maxEvidence, `Не больше ${L.maxEvidence} доказательств`).default([]),
});

export type RequestInput = {
  staticId: string;
  minutes: number;
  rules: string[];
  evidence: EvidenceItem[];
};

export function validateRequest(input: unknown): { ok: true; value: RequestInput } | { ok: false; error: string } {
  const result = requestSchema.safeParse(input);
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? "Проверьте заполнение формы" };

  const rules: string[] = [];
  for (const raw of result.data.rules) {
    const label = normalizeRuleLabel(raw);
    if (!label) return { ok: false, error: `Пункт «${raw.slice(0, 30)}» нужно записать как «ОП 4.9»` };
    if (!rules.includes(label)) rules.push(label);
  }

  const seen = new Set<string>();
  const evidence = result.data.evidence.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  return { ok: true, value: { staticId: result.data.staticId, minutes: result.data.minutes, rules, evidence } };
}

export const noteSchema = z.string().trim().max(L.noteMax, `Причина не длиннее ${L.noteMax} символов`);
