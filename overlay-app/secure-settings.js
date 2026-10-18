"use strict";

/**
 * Настройки на диске и для окна программы.
 *  - Ключ доступа и старый общий токен шифруются средствами системы (Electron safeStorage: DPAPI в Windows)
 *    и лежат в settings.json только в зашифрованном виде. Если шифрование недоступно, секреты не пишутся на диск.
 *  - Окно программы никогда не получает ключ целиком: вместо него приходит MASK.
 *  - Изменения из окна проходят через sanitizePatch: только известные ключи и значения того же типа.
 */

const SECRET_KEYS = ["userToken", "token"];
const MASK = "rgo_••••••••••••••••";
/** Эти поля меняются только отдельными путями (подключение, сохранение положения окна), не общим патчем. */
const GUARDED_KEYS = new Set([...SECRET_KEYS, "serverUrl", "bounds", "compactBounds", "hudPos"]);

function seal(settings, storage) {
  const out = {};
  const secrets = {};
  const canEncrypt = Boolean(storage?.isEncryptionAvailable?.());
  for (const [key, value] of Object.entries(settings)) {
    if (!SECRET_KEYS.includes(key)) {
      out[key] = value;
    } else if (value && canEncrypt) {
      secrets[key] = storage.encryptString(String(value)).toString("base64");
    }
  }
  if (Object.keys(secrets).length > 0) out.secrets = secrets;
  return out;
}

/** Читает файл настроек. migrated = true, если в нём остался открытый ключ старой версии: его пора перезаписать. */
function unseal(raw, storage, defaults) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const { secrets, ...rest } = source;
  const settings = { ...defaults, ...rest };
  let migrated = false;
  for (const key of SECRET_KEYS) {
    if (typeof rest[key] === "string" && rest[key]) migrated = true;
    const sealed = secrets && typeof secrets === "object" ? secrets[key] : null;
    if (typeof sealed === "string" && sealed) {
      try {
        settings[key] = storage.decryptString(Buffer.from(sealed, "base64"));
      } catch {
        settings[key] = ""; // другая учётная запись Windows или повреждённый файл: нужно подключиться заново
      }
    } else if (typeof rest[key] !== "string") {
      settings[key] = defaults[key] ?? "";
    }
  }
  return { settings, migrated };
}

const publicSettings = (settings) => ({
  ...settings,
  userToken: settings.userToken ? MASK : "",
  token: settings.token ? MASK : "",
});

/** Из патча окна оставляет только известные настройки с тем же типом значения, что и по умолчанию. */
function sanitizePatch(patch, defaults) {
  const clean = {};
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return clean;
  for (const [key, value] of Object.entries(patch)) {
    if (GUARDED_KEYS.has(key) || !(key in defaults)) continue;
    const base = defaults[key];
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    if (typeof value === "string" && value.length > 500) continue;
    const same = base === null ? value === null || typeof value === "object" : typeof value === typeof base;
    if (same) clean[key] = value;
  }
  return clean;
}

module.exports = { MASK, SECRET_KEYS, seal, unseal, publicSettings, sanitizePatch };
