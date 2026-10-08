import { z } from "zod";

import {
  COMMAND_LEVEL_MAX,
  COMMAND_LIMITS,
} from "@/app/(main)/(dashboard)/commands/_data/commands";

export const commandSchema = z.object({
  level: z
    .number({ error: "Выберите уровень" })
    .int("Выберите уровень")
    .min(1, "Выберите уровень")
    .max(COMMAND_LEVEL_MAX, "Такого уровня нет"),
  // Косую черту в начале дописываем сами: «ban» и «/ban» — одна и та же команда
  command: z
    .string()
    .trim()
    .min(1, "Введите команду")
    .max(COMMAND_LIMITS.command, "Команда слишком длинная")
    .transform((value) => (value.startsWith("/") ? value : `/${value}`))
    .refine((value) => /^\/[^\s/]+$/.test(value), "Команда пишется одним словом, например /ban"),
  argument: z.string().trim().max(COMMAND_LIMITS.argument, "Аргументы слишком длинные"),
  description: z
    .string()
    .trim()
    .min(1, "Введите описание")
    .max(COMMAND_LIMITS.description, "Описание слишком длинное"),
});

export type CommandInput = z.infer<typeof commandSchema>;

export function validateCommand(
  input: unknown,
): { ok: true; command: CommandInput } | { ok: false; error: string } {
  const result = commandSchema.safeParse(input);
  if (result.success) return { ok: true, command: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "Проверьте заполнение формы" };
}
