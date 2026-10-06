/** Никнейм и Statik ID администратора. Файл без серверного кода: можно импортировать и в клиентских компонентах. */

export const IDENTITY_LIMITS = {
  nicknameMin: 2,
  nicknameMax: 32,
  staticMaxDigits: 9,
} as const;

/** Буквы и цифры в начале, дальше ещё пробел, «_», «-», «.». */
const NICKNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u;

export type IdentityInput = { nickname: string | null; staticId: string | null };

/**
 * Приводит значения из формы к виду для базы: пустое поле означает «не указано» (null).
 * Никнейм: от 2 до 32 символов, без переносов строк. Статик: только цифры.
 */
export function validateIdentity(input: {
  nickname?: unknown;
  staticId?: unknown;
}): { ok: true; value: IdentityInput } | { ok: false; error: string } {
  if (
    (input.nickname !== null && input.nickname !== undefined && typeof input.nickname !== "string") ||
    (input.staticId !== null && input.staticId !== undefined && typeof input.staticId !== "string")
  ) {
    return { ok: false, error: "Некорректные данные" };
  }

  const nickname = (input.nickname ?? "").trim().replace(/\s+/g, " ");
  const staticId = (input.staticId ?? "").trim();

  if (nickname !== "") {
    if (nickname.length < IDENTITY_LIMITS.nicknameMin || nickname.length > IDENTITY_LIMITS.nicknameMax) {
      return {
        ok: false,
        error: `Никнейм от ${IDENTITY_LIMITS.nicknameMin} до ${IDENTITY_LIMITS.nicknameMax} символов`,
      };
    }
    if (!NICKNAME_PATTERN.test(nickname)) {
      return { ok: false, error: "Никнейм: буквы, цифры, пробел и символы _ - ." };
    }
  }

  if (staticId !== "" && !new RegExp(`^\\d{1,${IDENTITY_LIMITS.staticMaxDigits}}$`).test(staticId)) {
    return { ok: false, error: `Statik ID состоит из цифр, не больше ${IDENTITY_LIMITS.staticMaxDigits}` };
  }

  return { ok: true, value: { nickname: nickname || null, staticId: staticId || null } };
}
