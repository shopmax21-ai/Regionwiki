import { CODE_LENGTH } from "./config";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Токен из ссылки t.me/<бот>?start=<токен>: 32 символа base64url, подходит под лимит Telegram. */
export const newAttemptToken = () => randomBytes(24).toString("base64url");

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const isAttemptToken = (value: string) => /^[A-Za-z0-9_-]{32}$/.test(value);

/** Случайный код из 6 цифр, например «042917». */
export const generateCode = () => String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");

/** Хэш кода привязан к попытке, поэтому в базе кода нет, а чужой хэш не подойдёт. */
export const hashCode = (code: string, tokenHash: string, secret: string) =>
  createHmac("sha256", secret).update(`${tokenHash}:${code}`).digest("hex");

export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
