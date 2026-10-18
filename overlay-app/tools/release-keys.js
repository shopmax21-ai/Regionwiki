#!/usr/bin/env node
"use strict";

/**
 * Ключи подписи обновлений.
 *   npm run keygen                      — один раз: создаёт release-private.pem (хранить в секрете, не коммитить)
 *                                         и update-key.pub (открытый ключ, вшивается в программу)
 *   npm run sign -- "dist/REGION Overlay-1.14.0.exe"
 *                                       — создаёт рядом файл «…exe.sig»; его кладут на сайт вместе с .exe
 * Закрытый ключ берётся из REGION_RELEASE_KEY (содержимое PEM, удобно для CI) или из файла release-private.pem.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { signUpdate } = require("../signing");

const root = path.join(__dirname, "..");
const privatePath = path.join(root, "release-private.pem");
const publicPath = path.join(root, "update-key.pub");

function keygen() {
  if (fs.existsSync(privatePath)) {
    console.error("release-private.pem уже есть: новый ключ сделает уже выпущенные сборки неспособными обновляться. Удалите файл вручную, если это нужно.");
    process.exit(1);
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  fs.writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  fs.writeFileSync(publicPath, publicKey.export({ type: "spki", format: "pem" }));
  console.log("Готово.\n  release-private.pem — закрытый ключ: храните в секрете и сделайте копию, не коммитьте.\n  update-key.pub — открытый ключ: коммитьте, он вшивается в сборку.");
}

function sign(file) {
  if (!file || !fs.existsSync(file)) {
    console.error("Укажите существующий .exe: npm run sign -- \"dist/REGION Overlay-1.14.0.exe\"");
    process.exit(1);
  }
  const match = /^REGION Overlay-(\d+\.\d+\.\d+)\.exe$/i.exec(path.basename(file));
  if (!match) {
    console.error("Имя файла должно быть вида «REGION Overlay-X.Y.Z.exe» (portable-сборка).");
    process.exit(1);
  }
  const key = process.env.REGION_RELEASE_KEY || (fs.existsSync(privatePath) ? fs.readFileSync(privatePath, "utf8") : "");
  if (!key) {
    console.error("Нет закрытого ключа: выполните npm run keygen или задайте REGION_RELEASE_KEY.");
    process.exit(1);
  }
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  fs.writeFileSync(`${file}.sig`, `${signUpdate(key, match[1], sha256)}\n`);
  console.log(`Подписано: ${path.basename(file)}.sig (версия ${match[1]}, sha256 ${sha256.slice(0, 12)}…)`);
}

const [command, arg] = process.argv.slice(2);
if (command === "keygen") keygen();
else if (command === "sign") sign(arg);
else console.error("Команды: keygen | sign <файл.exe>");
