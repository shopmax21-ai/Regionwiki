import { z } from "zod";

import {
  type EvidenceItem,
  isDaysKind,
  PUNISHMENT_LIMITS as L,
  MUTE_CHANNELS,
  type MuteChannel,
  PUNISHMENT_KINDS,
  type PunishmentKind,
} from "./types";

/** «ОП 4.9», «ГС 1.2»: тег статьи и номер пункта. Регистр тега и пробелы приводятся к единому виду. */
const RULE_PATTERN = /^([A-Za-zА-Яа-яЁё]{1,10})\s*(\d{1,3}(?:\.\d{1,3}){0,3})$/;

export function normalizeRuleLabel(value: string): string | null {
  const match = RULE_PATTERN.exec(value.trim());
  return match ? `${match[1].toUpperCase()} ${match[2]}` : null;
}

/**
 * Название жалобы на форуме («Garik-0018»): одна строка без переносов и управляющих символов, пробелы по краям
 * убираются, внутренние схлопываются. Пустая строка означает «не указано».
 */
export function normalizeForum(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: "" };
  if (typeof value !== "string") return { ok: false, error: "Некорректное название жалобы" };
  // biome-ignore lint/suspicious/noControlCharactersInRegex: управляющие символы в команде недопустимы
  if (/[\u0000-\u001f\u007f]/.test(value)) return { ok: false, error: "Название жалобы должно быть в одну строку" };
  const forum = value.trim().replace(/\s+/g, " ");
  if (forum.length > L.forumMax) return { ok: false, error: `Название жалобы не длиннее ${L.forumMax} символов` };
  return { ok: true, value: forum };
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
  kind: z.enum(PUNISHMENT_KINDS as [PunishmentKind, ...PunishmentKind[]], "Выберите вид наказания"),
  muteChannel: z.enum(MUTE_CHANNELS as [MuteChannel, ...MuteChannel[]]).nullish(),
  duration: z.number("Укажите срок наказания").int("Срок указывается целым числом"),
  forum: z.unknown().optional(),
  rules: z
    .array(z.string())
    .min(1, "Укажите хотя бы один пункт правил")
    .max(L.maxRules, `Не больше ${L.maxRules} пунктов правил`),
  evidence: z.array(evidenceItem).max(L.maxEvidence, `Не больше ${L.maxEvidence} доказательств`).default([]),
});

export type RequestInput = {
  staticId: string;
  kind: PunishmentKind;
  muteChannel: MuteChannel | null;
  duration: number;
  forum: string;
  rules: string[];
  evidence: EvidenceItem[];
};

export function validateRequest(input: unknown): { ok: true; value: RequestInput } | { ok: false; error: string } {
  const result = requestSchema.safeParse(input);
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? "Проверьте заполнение формы" };

  const { kind } = result.data;
  const days = isDaysKind(kind);
  const min = days ? L.minDays : L.minMinutes;
  const max = days ? L.maxDays : L.maxMinutes;
  const { duration } = result.data;
  if (duration < min || duration > max) {
    return { ok: false, error: days ? `Срок от ${min} до ${max} дн.` : `Срок от ${min} до ${max} мин` };
  }

  let muteChannel: MuteChannel | null = null;
  if (kind === "mute") {
    if (!result.data.muteChannel) return { ok: false, error: "Укажите тип мута: chat или voice" };
    muteChannel = result.data.muteChannel;
  }

  const forum = normalizeForum(result.data.forum);
  if (!forum.ok) return forum;

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

  return {
    ok: true,
    value: { staticId: result.data.staticId, kind, muteChannel, duration, forum: forum.value, rules, evidence },
  };
}

export const noteSchema = z.string().trim().max(L.noteMax, `Причина не длиннее ${L.noteMax} символов`);
