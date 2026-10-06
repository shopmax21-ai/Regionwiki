/** Никнейм и Static ID администратора. Файл без серверного кода: можно импортировать и в клиентских компонентах. */

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
    return { ok: false, error: `Static ID состоит из цифр, не больше ${IDENTITY_LIMITS.staticMaxDigits}` };
  }

  return { ok: true, value: { nickname: nickname || null, staticId: staticId || null } };
}

/**
 * Никнейм и Static ID указываются один раз. Дальше их меняет только вышестоящий администратор.
 * Признак «уже указано» — любое из двух полей заполнено.
 */
export const identityLocked = (value: { nickname: string | null; staticId: string | null }): boolean =>
  value.nickname !== null || value.staticId !== null;

/** Первое заполнение: нужны оба поля, потому что потом самому исправить их будет нельзя. */
export function validateFirstIdentity(input: {
  nickname?: unknown;
  staticId?: unknown;
}): { ok: true; value: { nickname: string; staticId: string } } | { ok: false; error: string } {
  const parsed = validateIdentity(input);
  if (!parsed.ok) return parsed;
  const { nickname, staticId } = parsed.value;
  if (!nickname || !staticId) return { ok: false, error: "Укажите и Никнейм, и Static ID" };
  return { ok: true, value: { nickname, staticId } };
}
