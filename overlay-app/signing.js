"use strict";

const crypto = require("node:crypto");

/**
 * Подпись обновлений (Ed25519). Подписывается пара «версия + SHA-256 файла», закрытый ключ хранится только у того,
 * кто выпускает сборки, а открытый (update-key.pub) вшит в программу. Поэтому даже если сайт или канал связи
 * подменят файл, программа его не поставит: без подписи нужного ключа проверка не пройдёт.
 */

const signedMessage = (version, sha256) =>
  Buffer.from(`region-overlay-update\nv1\n${String(version).trim().replace(/^v/i, "")}\n${String(sha256).trim().toLowerCase()}`, "utf8");

function signUpdate(privateKeyPem, version, sha256) {
  return crypto.sign(null, signedMessage(version, sha256), privateKeyPem).toString("base64");
}

function verifyUpdate({ publicKey, version, sha256, signature }) {
  if (!publicKey || !/^[a-f0-9]{64}$/i.test(String(sha256 || "")) || !signature) return false;
  try {
    return crypto.verify(null, signedMessage(version, sha256), publicKey, Buffer.from(String(signature), "base64"));
  } catch {
    return false;
  }
}

module.exports = { signedMessage, signUpdate, verifyUpdate };
