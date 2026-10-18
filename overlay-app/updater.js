const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn: realSpawn } = require("node:child_process");

const { normalizeOrigin } = require("./site-key");
const { verifyUpdate } = require("./signing");

/**
 * Автообновление portable-версии через сайт (тот же, к которому подключён оверлей).
 * Сайт отдаёт GET /api/overlay/version → { ok, version, file, size, sha256, signature, url, notes }.
 * signature — подпись Ed25519 над «версия + sha256», её ставит выпускающий сборку (см. tools/release-keys.js).
 * Без подписи, которая сходится с вшитым открытым ключом, обновление не скачивается и не ставится.
 * Новый .exe скачивается рядом с текущим, проверяется контрольная сумма, а подмена файла
 * делается отдельным скриптом после выхода из приложения (запущенный .exe Windows заменить не даёт).
 */

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FILE_RE = /^[\w .()\-]{1,120}\.exe$/i;
const MAX_SIZE = 600 * 1024 * 1024;

const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const parseVersion = (value) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(value || "").trim());
  return m ? m.slice(1).map(Number) : null;
};

/** true, если a новее b. Не разобрали версию: считаем, что обновления нет. */
function isNewer(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

/** PowerShell-скрипт подмены: ждёт, пока старый файл освободится, заменяет его новым и (по желанию) запускает. */
function buildSwapScript({ source, target, restart }) {
  const payload = Buffer.from(JSON.stringify({ source, target, restart: Boolean(restart) }), "utf8").toString("base64");
  return `
$ErrorActionPreference = 'Stop'
$p = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}')) | ConvertFrom-Json
$done = $false
for ($i = 0; $i -lt 160; $i++) {
  try { Move-Item -LiteralPath $p.source -Destination $p.target -Force; $done = $true; break }
  catch { Start-Sleep -Milliseconds 500 }
}
if ($done -and $p.restart) { Start-Process -FilePath $p.target }
`;
}

function createUpdater({ publicKey = null, getSettings, getVersion, getTarget, getDir, onState, onReady, canInstall = true, spawnImpl = realSpawn, platform = process.platform }) {
  let state = { status: "idle", current: getVersion(), latest: null, notes: "", progress: 0, error: null, checkedAt: null, canInstall, manualUrl: null };
  let timer = null;
  let busy = false;
  let ready = null; // { file, version }
  let applied = false;
  let info = null;

  const set = (patch) => {
    state = { ...state, ...patch };
    onState?.({ ...state });
  };

  const baseUrl = () => normalizeOrigin(getSettings().serverUrl);

  const headers = () => {
    const token = String(getSettings().userToken || "").trim();
    return { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  async function check({ manual = false } = {}) {
    if (busy || state.status === "downloading") return state;
    const base = baseUrl();
    if (!base) {
      if (manual) set({ status: "error", error: "Сайт не подключён: добавьте ключ в настройках" });
      return state;
    }
    if (!publicKey) {
      // Без открытого ключа проверить подлинность файла нечем, поэтому обновления отключены
      if (manual) set({ status: "error", error: "В этой сборке нет ключа проверки подписи (update-key.pub): автообновление отключено" });
      return state;
    }
    busy = true;
    if (manual) set({ status: "checking", error: null });
    try {
      const response = await fetch(`${base}/api/overlay/version`, { headers: headers(), signal: AbortSignal.timeout(15_000) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false || !parseVersion(body.version)) {
        if (manual) set({ status: "error", error: response.status === 404 ? "Сайт пока не отдаёт сведения об обновлениях" : body.error || `Сайт ответил ${response.status}` });
        return state;
      }
      state = { ...state, checkedAt: new Date().toISOString() };
      if (!isNewer(body.version, getVersion())) {
        set({ status: "uptodate", latest: body.version, error: null, notes: "" });
        return state;
      }
      // Скачиваем только с того же сайта и только .exe с безопасным именем
      const url = new URL(String(body.url || ""), `${base}/`);
      if (url.origin !== new URL(base).origin || !FILE_RE.test(String(body.file || ""))) {
        set({ status: "error", error: "Сайт указал недопустимую ссылку на обновление" });
        return state;
      }
      const sha256 = String(body.sha256 || "").toLowerCase();
      if (!verifyUpdate({ publicKey, version: body.version, sha256, signature: body.signature })) {
        set({ status: "error", error: "Подпись обновления не подошла: файл не будет скачан и установлен" });
        return state;
      }
      const size = Number(body.size) || 0;
      if (size > MAX_SIZE) {
        set({ status: "error", error: "Сайт указал недопустимый размер обновления" });
        return state;
      }
      info = { version: body.version, file: body.file, size, sha256, url: url.href };
      set({ status: "available", latest: body.version, notes: String(body.notes || "").slice(0, 600), error: null, manualUrl: info.url });
      if (canInstall && getSettings().autoUpdate !== false) await download();
      return state;
    } catch (error) {
      if (manual) set({ status: "error", error: `Не удалось связаться с сайтом (${error?.cause?.code || error?.name || "ошибка сети"})` });
      return state;
    } finally {
      busy = false;
    }
  }

  async function download() {
    if (!info || !canInstall) return state;
    if (ready?.version === info.version) { set({ status: "ready" }); return state; }
    const dir = getDir();
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
    } catch {
      set({ status: "available", error: "Нет прав на запись в папку с программой: скачайте обновление вручную" });
      return state;
    }
    const temp = path.join(dir, `${info.file}.download`);
    const final = path.join(dir, `${info.file}.ready`);
    const signedSha = info.sha256;
    set({ status: "downloading", progress: 0, error: null });
    try {
      const response = await fetch(info.url, { headers: headers(), signal: AbortSignal.timeout(10 * 60_000) });
      if (!response.ok || !response.body) throw new Error(`Сайт ответил ${response.status}`);
      const total = Number(response.headers.get("content-length")) || info.size;
      const hash = crypto.createHash("sha256");
      const out = fs.createWriteStream(temp);
      let streamError = null;
      out.on("error", (error) => { streamError = error; });
      let received = 0;
      let lastEmit = 0;
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (streamError) throw streamError;
          hash.update(value);
          received += value.length;
          if (received > (info.size || MAX_SIZE)) throw new Error("Файл больше, чем заявлено");
          await new Promise((resolve, reject) => out.write(value, (error) => (error ? reject(error) : resolve())));
          if (total && Date.now() - lastEmit > 250) { lastEmit = Date.now(); set({ progress: Math.min(0.99, received / total) }); }
        }
        await new Promise((resolve, reject) => out.end((error) => (error ? reject(error) : resolve())));
      } catch (error) {
        reader.cancel().catch(() => undefined);
        out.destroy();
        throw error;
      }
      if (info.size && received !== info.size) throw new Error("Файл скачался не полностью");
      if (hash.digest("hex") !== info.sha256) throw new Error("Контрольная сумма не совпала");
      fs.renameSync(temp, final);
      ready = { file: final, version: info.version, sha256: signedSha };
      set({ status: "ready", progress: 1, error: null });
      onReady?.({ ...state });
    } catch (error) {
      try { fs.rmSync(temp, { force: true }); } catch { /* временный файл мог не создаться */ }
      set({ status: "available", progress: 0, error: `Не удалось скачать обновление: ${error.message}` });
    }
    return state;
  }

  /** Подмена файла: скрипт ждёт выхода из приложения. Вызывающий код после успеха сам закрывает программу. */
  function install({ restart = true } = {}) {
    if (!ready || applied) return { ok: false, error: "Обновление ещё не скачано" };
    const target = getTarget();
    if (!target || platform !== "win32") return { ok: false, error: "Автоустановка работает только в portable-версии для Windows" };
    try {
      // Файл лежит рядом с программой, где его мог тронуть кто угодно: перед подменой сверяем с подписанной суммой ещё раз
      if (sha256File(ready.file) !== ready.sha256) {
        try { fs.rmSync(ready.file, { force: true }); } catch { /* уже удалён */ }
        ready = null;
        set({ status: "error", error: "Скачанный файл изменился, обновление отменено. Проверьте обновления заново" });
        return { ok: false, error: "Скачанный файл изменился" };
      }
      const script = buildSwapScript({ source: ready.file, target, restart });
      const encoded = Buffer.from(script, "utf16le").toString("base64");
      const child = spawnImpl("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-EncodedCommand", encoded], { detached: true, stdio: "ignore", windowsHide: true });
      child.unref?.();
      applied = true;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: `Не удалось запустить установку: ${error.message}` };
    }
  }

  /** При обычном выходе скачанное обновление ставится тихо, без перезапуска. */
  const applyOnQuit = () => (ready && !applied ? install({ restart: false }) : { ok: false });

  function start() {
    clearInterval(timer);
    // Хвосты прерванных загрузок
    try {
      const dir = getDir();
      for (const name of fs.readdirSync(dir)) if (/\.exe\.(download|ready)$/i.test(name)) fs.rmSync(path.join(dir, name), { force: true });
    } catch { /* папки может не быть */ }
    setTimeout(() => check(), 15_000).unref?.();
    timer = setInterval(() => check(), CHECK_INTERVAL_MS);
    timer.unref?.();
  }

  return { start, stop: () => clearInterval(timer), check, download, install, applyOnQuit, getState: () => ({ ...state }) };
}

module.exports = { createUpdater, isNewer, parseVersion, buildSwapScript };
