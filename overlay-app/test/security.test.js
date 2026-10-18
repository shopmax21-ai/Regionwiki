const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { normalizeOrigin, originFromKey, findKey, isHostTrusted } = require("../site-key");
const { MASK, seal, unseal, publicSettings, sanitizePatch } = require("../secure-settings");
const { signUpdate, verifyUpdate } = require("../signing");

const b64 = (text) => Buffer.from(text).toString("base64url");
const key = (origin) => `rgo_${b64(origin)}.${"a".repeat(43)}`;

// Адрес сайта: только https, localhost допускается и по http
assert.equal(normalizeOrigin("https://wiki.example.ru/path?x=1"), "https://wiki.example.ru");
assert.equal(normalizeOrigin("wiki.example.ru"), "https://wiki.example.ru");
assert.equal(normalizeOrigin("http://wiki.example.ru"), "");
assert.equal(normalizeOrigin("http://localhost:3000"), "http://localhost:3000");
assert.equal(normalizeOrigin("http://127.0.0.1:8080"), "http://127.0.0.1:8080");
assert.equal(normalizeOrigin("https://user:pass@wiki.example.ru"), "");
assert.equal(normalizeOrigin("javascript:alert(1)"), "");
assert.equal(normalizeOrigin("file:///etc/passwd"), "");
assert.equal(normalizeOrigin(""), "");

// Адрес из ключа
assert.equal(originFromKey(key("https://wiki.example.ru")), "https://wiki.example.ru");
assert.equal(originFromKey(key("http://evil.example")), "");
assert.equal(originFromKey(key("ftp://evil.example")), "");
assert.equal(originFromKey("rgo_!!!.short"), "");
assert.equal(findKey(`текст ${key("https://a.ru")} ещё`), key("https://a.ru"));
assert.equal(findKey("ничего"), "");

// Список разрешённых сайтов
assert.equal(isHostTrusted("https://wiki.example.ru", []), true);
assert.equal(isHostTrusted("https://wiki.example.ru", ["wiki.example.ru"]), true);
assert.equal(isHostTrusted("https://evil.example", ["wiki.example.ru"]), false);
assert.equal(isHostTrusted("https://wiki.example.ru.evil.example", ["wiki.example.ru"]), false);

// Шифрование ключа: на диске только зашифрованное значение
const storage = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(`ENC:${text}`),
  decryptString: (buffer) => {
    const text = buffer.toString();
    if (!text.startsWith("ENC:")) throw new Error("bad");
    return text.slice(4);
  },
};
const defaults = { hotkey: "Alt+R", opacity: 0.96, hud: true, userToken: "", token: "", serverUrl: "", bounds: null };
const secret = key("https://wiki.example.ru");
const onDisk = seal({ ...defaults, userToken: secret, serverUrl: "https://wiki.example.ru" }, storage);
assert.equal(JSON.stringify(onDisk).includes(secret), false);
assert.equal("userToken" in onDisk, false);
assert.equal(unseal(JSON.parse(JSON.stringify(onDisk)), storage, defaults).settings.userToken, secret);
// Без шифрования секреты на диск не попадают
assert.equal(JSON.stringify(seal({ ...defaults, userToken: secret }, { isEncryptionAvailable: () => false })).includes(secret), false);
// Старый файл с открытым ключом читается и помечается для перезаписи
const legacy = unseal({ hotkey: "Alt+X", userToken: secret }, storage, defaults);
assert.equal(legacy.settings.userToken, secret);
assert.equal(legacy.migrated, true);
// Испорченный шифртекст не ломает запуск
assert.equal(unseal({ secrets: { userToken: Buffer.from("junk").toString("base64") } }, storage, defaults).settings.userToken, "");

// Окно получает только маску
assert.equal(publicSettings({ ...defaults, userToken: secret }).userToken, MASK);
assert.equal(publicSettings(defaults).userToken, "");
assert.equal(JSON.stringify(publicSettings({ ...defaults, userToken: secret, token: "old" })).includes(secret), false);

// Патч из окна: чужие ключи, ключ доступа, адрес и неверные типы отбрасываются
assert.deepEqual(
  sanitizePatch({ hotkey: "Alt+Q", opacity: 0.5, userToken: "x", serverUrl: "https://evil", token: "t", bounds: { x: 1 }, nope: 1, hud: "yes", __proto__: { a: 1 } }, defaults),
  { hotkey: "Alt+Q", opacity: 0.5 },
);
assert.deepEqual(sanitizePatch({ opacity: Infinity, hotkey: "x".repeat(501) }, defaults), {});
assert.deepEqual(sanitizePatch(null, defaults), {});

// Подпись обновления
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const pub = publicKey.export({ type: "spki", format: "pem" });
const priv = privateKey.export({ type: "pkcs8", format: "pem" });
const sha = "a".repeat(64);
const signature = signUpdate(priv, "1.2.3", sha);
assert.equal(verifyUpdate({ publicKey: pub, version: "1.2.3", sha256: sha, signature }), true);
assert.equal(verifyUpdate({ publicKey: pub, version: "v1.2.3", sha256: sha.toUpperCase(), signature }), true);
assert.equal(verifyUpdate({ publicKey: pub, version: "1.2.4", sha256: sha, signature }), false);
assert.equal(verifyUpdate({ publicKey: pub, version: "1.2.3", sha256: "b".repeat(64), signature }), false);
assert.equal(verifyUpdate({ publicKey: pub, version: "1.2.3", sha256: sha, signature: "" }), false);
assert.equal(verifyUpdate({ publicKey: pub, version: "1.2.3", sha256: sha, signature: "!!!" }), false);
assert.equal(verifyUpdate({ publicKey: null, version: "1.2.3", sha256: sha, signature }), false);

console.log("security tests passed");
