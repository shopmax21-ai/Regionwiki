const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createUpdater, isNewer, buildSwapScript } = require("../updater");
const { signUpdate } = require("../signing");

const keys = crypto.generateKeyPairSync("ed25519");
const PUB = keys.publicKey.export({ type: "spki", format: "pem" });
const PRIV = keys.privateKey.export({ type: "pkcs8", format: "pem" });
const other = crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" });
const release = (version, sha, extra = {}) => ({ ok: true, version, file: `REGION Overlay-${version}.exe`, url: "/api/overlay/download?file=x", sha256: sha, signature: signUpdate(PRIV, version, sha), ...extra });

// Сравнение версий
assert.equal(isNewer("1.8.0", "1.7.0"), true);
assert.equal(isNewer("1.7.0", "1.7.0"), false);
assert.equal(isNewer("1.7.1", "1.8.0"), false);
assert.equal(isNewer("2.0.0", "1.99.99"), true);
assert.equal(isNewer("v1.10.0", "1.9.0"), true);
assert.equal(isNewer("мусор", "1.0.0"), false);

// Скрипт подмены: пути и перезапуск передаются как данные, а не вклеиваются в команду
const script = buildSwapScript({ source: "C:\\a b\\x.exe.ready", target: "C:\\a b\\REGION Overlay.exe", restart: true });
const payload = JSON.parse(Buffer.from(/FromBase64String\('([^']+)'\)/.exec(script)[1], "base64").toString("utf8"));
assert.deepEqual(payload, { source: "C:\\a b\\x.exe.ready", target: "C:\\a b\\REGION Overlay.exe", restart: true });
assert.match(script, /Move-Item/);

const exe = Buffer.from("MZ-fake-exe-".repeat(5000));
const sha = crypto.createHash("sha256").update(exe).digest("hex");
let manifest;
const server = http.createServer((req, res) => {
  if (req.url === "/api/overlay/version") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(manifest)); return; }
  if (req.url.startsWith("/api/overlay/download")) { res.setHeader("Content-Length", exe.length); res.end(exe); return; }
  res.statusCode = 404; res.end("{}");
});

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upd-"));
  const settings = { serverUrl: base, userToken: "rgo_ok", autoUpdate: true };
  const states = [];
  let readyCalls = 0;
  const spawned = [];
  const make = (extra = {}) => createUpdater({
    publicKey: PUB,
    getSettings: () => settings, getVersion: () => "1.7.0", getTarget: () => path.join(dir, "REGION Overlay.exe"), getDir: () => dir,
    onState: (s) => states.push(s.status), onReady: () => { readyCalls += 1; },
    spawnImpl: (cmd, args, opts) => { spawned.push({ cmd, args, opts }); return { unref() {} }; }, platform: "win32", ...extra,
  });

  // Та же версия: обновления нет
  manifest = release("1.7.0", sha, { size: exe.length });
  let u = make();
  await u.check({ manual: true });
  assert.equal(u.getState().status, "uptodate");

  // Новая версия: скачивается сама и проверяется контрольная сумма
  manifest = release("1.8.0", sha, { size: exe.length, notes: "Новое" });
  u = make();
  await u.check({ manual: true });
  assert.equal(u.getState().status, "ready");
  assert.equal(readyCalls, 1);
  assert.equal(fs.readFileSync(path.join(dir, "REGION Overlay-1.8.0.exe.ready")).length, exe.length);
  assert.equal(fs.existsSync(path.join(dir, "REGION Overlay-1.8.0.exe.download")), false);

  // Установка: запускается один скрипт PowerShell, повторный вызов ничего не делает
  const first = u.install({ restart: true });
  assert.equal(first.ok, true);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].cmd, "powershell.exe");
  assert.equal(spawned[0].opts.detached, true);
  assert.equal(u.install().ok, false);
  assert.equal(u.applyOnQuit().ok, false);

  // Неверная контрольная сумма: файл отвергается и не остаётся на диске
  fs.rmSync(path.join(dir, "REGION Overlay-1.8.0.exe.ready"));
  manifest = release("1.9.0", "0".repeat(64), { size: exe.length });
  u = make();
  await u.check({ manual: true });
  assert.equal(u.getState().status, "available");
  assert.match(u.getState().error, /контрольная сумма/i);
  assert.equal(fs.readdirSync(dir).some((n) => n.includes("1.9.0")), false);
  assert.equal(u.install().ok, false);

  // Ссылка на чужой сайт и странное имя файла отвергаются
  manifest = release("2.0.0", sha, { url: "https://evil.example/x.exe", size: exe.length });
  u = make();
  await u.check({ manual: true });
  assert.equal(u.getState().status, "error");
  manifest = release("2.0.0", sha, { file: "..\\..\\evil.exe", url: "/api/overlay/download", size: exe.length });
  await u.check({ manual: true });
  assert.equal(u.getState().status, "error");

  // Без подписи, с чужой подписью, с подписью другой версии или другой суммы файл не скачивается совсем
  const downloads = [];
  server.on("request", (req) => { if (req.url.startsWith("/api/overlay/download")) downloads.push(req.url); });
  for (const bad of [
    release("2.0.0", sha, { signature: undefined, size: exe.length }),
    release("2.0.0", sha, { signature: signUpdate(other, "2.0.0", sha), size: exe.length }),
    release("2.0.0", sha, { signature: signUpdate(PRIV, "1.9.9", sha), size: exe.length }),
    release("2.0.0", sha, { signature: signUpdate(PRIV, "2.0.0", "1".repeat(64)), size: exe.length }),
    release("2.0.0", sha, { sha256: undefined, size: exe.length }),
  ]) {
    manifest = bad;
    u = make();
    await u.check({ manual: true });
    assert.equal(u.getState().status, "error");
    assert.match(u.getState().error, /подпись/i);
    assert.equal(u.getState().manualUrl, null);
  }
  assert.equal(downloads.length, 0);

  // Сборка без открытого ключа: обновления отключены
  manifest = release("2.0.0", sha, { size: exe.length });
  u = make({ publicKey: null });
  await u.check({ manual: true });
  assert.equal(u.getState().status, "error");
  assert.match(u.getState().error, /ключа проверки/);

  // Небезопасный адрес сайта (http не для localhost) не используется
  settings.serverUrl = "http://wiki.example.ru";
  u = make();
  await u.check({ manual: true });
  assert.match(u.getState().error, /не подключён/);
  settings.serverUrl = base;

  // Файл, изменённый на диске после скачивания, не устанавливается
  manifest = release("2.1.0", sha, { size: exe.length });
  const spawnedBefore = spawned.length;
  u = make();
  await u.check({ manual: true });
  assert.equal(u.getState().status, "ready");
  fs.appendFileSync(path.join(dir, "REGION Overlay-2.1.0.exe.ready"), "evil");
  assert.equal(u.install().ok, false);
  assert.equal(spawned.length, spawnedBefore);

  // Автозагрузка выключена: только сообщаем, что версия доступна
  settings.autoUpdate = false;
  manifest = release("2.0.0", sha, { size: exe.length });
  u = make();
  await u.check({ manual: true });
  assert.equal(u.getState().status, "available");
  await u.download();
  assert.equal(u.getState().status, "ready");

  // Сайт без маршрута версии: понятное сообщение
  manifest = null;
  server.removeAllListeners("request");
  server.on("request", (req, res) => { res.statusCode = 404; res.end("{}"); });
  u = make();
  await u.check({ manual: true });
  assert.match(u.getState().error, /не отдаёт/);

  u.stop();
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("updater tests passed");
});
