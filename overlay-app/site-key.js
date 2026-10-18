"use strict";

/**
 * Адрес сайта и ключ доступа. Всё, что приходит снаружи (буфер обмена, настройки, файл копии), проходит через эти функции:
 * принимается только https (http допустим лишь для localhost при разработке), без логина и пароля в адресе.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const KEY_RE = /^rgo_([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]{20,}$/;
const KEY_FIND_RE = /rgo_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/;

/** Источник адреса → origin или пустая строка, если адрес небезопасен или это не адрес. */
function normalizeOrigin(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    if (url.username || url.password || !url.hostname) return "";
    const local = LOCAL_HOSTS.has(url.hostname);
    if (url.protocol === "https:" || (url.protocol === "http:" && local)) return url.origin;
    return "";
  } catch {
    return "";
  }
}

/** Ключ вида rgo_<адрес в base64url>.<секрет> → origin сайта или пустая строка. */
function originFromKey(key) {
  const match = KEY_RE.exec(String(key || "").trim());
  if (!match) return "";
  try {
    return normalizeOrigin(Buffer.from(match[1], "base64url").toString("utf8"));
  } catch {
    return "";
  }
}

const findKey = (text) => KEY_FIND_RE.exec(String(text || ""))?.[0] || "";

/** Пустой список разрешённых сайтов: подойдёт любой https-адрес, но смена сайта требует подтверждения пользователя. */
function isHostTrusted(origin, hosts) {
  if (!Array.isArray(hosts) || hosts.length === 0) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return hosts.some((item) => String(item).trim().toLowerCase() === host);
  } catch {
    return false;
  }
}

module.exports = { normalizeOrigin, originFromKey, findKey, isHostTrusted };
