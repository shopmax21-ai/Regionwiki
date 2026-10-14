const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen, Tray, Menu, nativeImage, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { createPunishments } = require("./punishments");

const DEFAULT_SETTINGS = {
  serverUrl: "",
  token: "",
  hotkey: "Alt+R",
  searchHotkey: "Alt+S",
  userToken: "",
  notifyPunishments: true,
  opacity: 0.96,
  alwaysOnTop: true,
  hideOnCopy: false,
  pasteOnCopy: false,
  openChatKey: "",
  lineDelay: 700,
  bounds: null,
  hud: true,
  hudCorner: "top-left",
  hudScale: 1,
  hudOpacity: 0.85,
  hudHotkey: "Alt+H",
  hudLocked: true,
  hudPos: null,
  lockWindow: false,
  compact: false,
  compactBounds: null,
};

const COMPACT_WIDTH = 720;
const COMPACT_HEIGHT = 58;

let win = null;
let hud = null;
let punishments = null;
let hudSize = { width: 260, height: 40 };
let hudSaveTimer = null;
let tray = null;
let settings = { ...DEFAULT_SETTINGS };
let binds = [];
let bindRunning = false;
let quitting = false;

const userFile = (name) => path.join(app.getPath("userData"), name);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
  } catch (error) {
    console.error("write failed", file, error);
  }
}

const loadSeedReplies = () => readJson(path.join(__dirname, "data", "seed-replies.json"), []);

/* ---------- окно ---------- */

function createWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  const saved = settings.bounds;
  const fullWidth = saved?.width ?? Math.min(880, area.width - 80);
  const fullHeight = saved?.height ?? Math.min(700, area.height - 80);
  const start = settings.compact
    ? compactTarget(area)
    : { x: saved?.x ?? area.x + area.width - fullWidth - 24, y: saved?.y ?? area.y + 40, width: fullWidth, height: fullHeight };
  win = new BrowserWindow({
    ...start,
    minWidth: settings.compact ? 360 : 380,
    minHeight: settings.compact ? 40 : 360,
    frame: false,
    transparent: false,
    backgroundColor: "#131314",
    show: false,
    skipTaskbar: true,
    resizable: true,
    fullscreenable: false,
    autoHideMenuBar: true,
    title: "REGION Overlay",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenu(null);
  applyWindowSettings();
  win.loadFile(path.join(__dirname, "src", "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    hideWindow();
  });
  const saveBounds = () => {
    if (!win || win.isDestroyed() || win.isMinimized()) return;
    if (settings.compact) settings.compactBounds = win.getBounds();
    else settings.bounds = win.getBounds();
    writeJson(userFile("settings.json"), settings);
  };
  let timer = null;
  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(saveBounds, 400);
  };
  win.on("resize", debounced);
  win.on("move", debounced);
  win.once("ready-to-show", () => showWindow());
}

/** Свёрнутый режим: узкая строка поиска. Ширина и положение запоминаются, высота растёт под список результатов. */
function compactTarget(area = screen.getPrimaryDisplay().workArea) {
  const saved = settings.compactBounds;
  const width = saved?.width ?? COMPACT_WIDTH;
  return {
    x: saved?.x ?? Math.round(area.x + (area.width - width) / 2),
    y: saved?.y ?? area.y + 24,
    width,
    height: COMPACT_HEIGHT,
  };
}

function setMode(compact) {
  if (!win || Boolean(settings.compact) === Boolean(compact)) return settings;
  if (compact) {
    settings.bounds = win.getBounds();
    settings.compact = true;
    win.setMinimumSize(360, 40);
    win.setBounds(compactTarget());
  } else {
    settings.compact = false;
    win.setMinimumSize(380, 360);
    const area = screen.getPrimaryDisplay().workArea;
    const saved = settings.bounds;
    win.setBounds({
      x: saved?.x ?? area.x + area.width - Math.min(880, area.width - 80) - 24,
      y: saved?.y ?? area.y + 40,
      width: saved?.width ?? Math.min(880, area.width - 80),
      height: saved?.height ?? Math.min(700, area.height - 80),
    });
  }
  writeJson(userFile("settings.json"), settings);
  return settings;
}

function applyWindowSettings() {
  if (!win) return;
  win.setOpacity(Math.min(1, Math.max(0.3, Number(settings.opacity) || 0.96)));
  // Уровень «screen-saver» держит окно выше игры в режиме «в окне без рамки».
  win.setAlwaysOnTop(Boolean(settings.alwaysOnTop), "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setMovable(!settings.lockWindow);
  win.setResizable(!settings.lockWindow);
}

function showWindow() {
  if (!win) return;
  applyWindowSettings();
  if (!settings.userToken) connectFromClipboard(true);
  win.show();
  win.focus();
  win.webContents.send("overlay:shown");
}

/* ---------- автоподключение к сайту: «код подключения» из буфера обмена ---------- */

/* ---------- подключение: один ключ из профиля на сайте ---------- */

const KEY_PATTERN = /rgo_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/;

/** Адрес сайта зашит в ключ (rgo_<адрес в base64url>.<секрет>), поэтому вводить ссылку не нужно. */
function originFromKey(key) {
  const match = /^rgo_([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]{20,}$/.exec(String(key || "").trim());
  if (!match) return "";
  try {
    const url = new URL(Buffer.from(match[1], "base64url").toString("utf8"));
    return /^https?:$/.test(url.protocol) ? url.origin : "";
  } catch {
    return "";
  }
}

/** Адрес всегда берётся из ключа; без ключа остаются настройки старых версий. */
function withDerivedUrl(next) {
  const origin = originFromKey(next.userToken);
  return origin ? { ...next, serverUrl: origin } : next;
}

/** auto: ключ из буфера обмена применяется сам, только если ключа ещё нет. */
function connectFromClipboard(auto = false) {
  const found = KEY_PATTERN.exec(clipboard.readText() || "");
  if (!found || !originFromKey(found[0])) return { ok: false };
  if (auto && settings.userToken) return { ok: false };
  settings = withDerivedUrl({ ...settings, userToken: found[0] });
  writeJson(userFile("settings.json"), settings);
  punishments?.restart();
  win?.webContents.send("settings:changed", settings);
  win?.webContents.send("overlay:connected");
  return { ok: true };
}

function hideWindow() {
  if (win && win.isVisible()) win.hide();
}

/** Быстрый поиск: сочетание открывает строку поиска поверх игры, повторное нажатие закрывает её. */
function toggleSearch() {
  if (!win) return;
  if (win.isVisible() && win.isFocused() && settings.compact) {
    hideWindow();
    return;
  }
  if (!settings.compact) setMode(true);
  showWindow();
  win.webContents.send("overlay:search");
}

function toggleWindow() {
  if (win?.isVisible() && win.isFocused()) hideWindow();
  else showWindow();
}

/* ---------- подсказки биндера на экране игры ---------- */

function createHud() {
  hud = new BrowserWindow({
    width: 260,
    height: 40,
    frame: false,
    transparent: true,
    hasShadow: false,
    show: false,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, "preload-hud.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  hud.setIgnoreMouseEvents(Boolean(settings.hudLocked));
  hud.setAlwaysOnTop(true, "screen-saver");
  hud.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  hud.loadFile(path.join(__dirname, "src", "hud.html"));
  hud.webContents.on("did-finish-load", updateHud);
  // Положение запоминаем, когда подсказки передвинули руками (пока они не зафиксированы).
  hud.on("move", () => {
    if (settings.hudLocked || !hud || hud.isDestroyed()) return;
    clearTimeout(hudSaveTimer);
    hudSaveTimer = setTimeout(() => {
      if (!hud || hud.isDestroyed()) return;
      const { x, y } = hud.getBounds();
      settings.hudPos = { x, y };
      writeJson(userFile("settings.json"), settings);
    }, 250);
  });
  hud.on("closed", () => {
    hud = null;
  });
}

function hudItems() {
  return binds.filter((bind) => bind.hotkey && bind.hint !== false).map((bind) => ({ id: bind.id, title: bind.title, hotkey: bind.hotkey, lines: String(bind.text || "").split(/\r?\n/).filter(Boolean).length }));
}

function placeHud(width, height) {
  if (!hud || hud.isDestroyed()) return;
  hudSize = { width, height };
  const saved = settings.hudPos;
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    const area = screen.getDisplayNearestPoint({ x: saved.x, y: saved.y }).workArea;
    const x = Math.min(Math.max(saved.x, area.x), area.x + area.width - width);
    const y = Math.min(Math.max(saved.y, area.y), area.y + area.height - height);
    hud.setBounds({ x, y, width, height });
    return;
  }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const margin = 12;
  const [vertical, horizontal] = String(settings.hudCorner || "top-left").split("-");
  const x = horizontal === "right" ? area.x + area.width - width - margin : area.x + margin;
  const y = vertical === "bottom" ? area.y + area.height - height - margin : area.y + margin;
  hud.setBounds({ x, y, width, height });
}

function updateHud() {
  const items = hudItems();
  if (!settings.hud || items.length === 0) {
    if (hud && !hud.isDestroyed()) hud.hide();
    return;
  }
  if (!hud) createHud();
  hud.setIgnoreMouseEvents(Boolean(settings.hudLocked));
  hud.webContents.send("hud:data", {
    items,
    scale: Number(settings.hudScale) || 1,
    opacity: Number(settings.hudOpacity) || 0.85,
    align: String(settings.hudCorner).endsWith("right") ? "right" : "left",
    locked: Boolean(settings.hudLocked),
  });
  // Скрытое окно не отрисовывает кадры и не пришлёт размер, поэтому возвращаем его на экран сразу.
  if (!hud.isVisible()) {
    placeHud(hudSize.width, hudSize.height);
    hud.showInactive();
  }
}

function toggleHud() {
  settings.hud = !settings.hud;
  writeJson(userFile("settings.json"), settings);
  updateHud();
  win?.webContents.send("settings:changed", settings);
}

/* ---------- горячие клавиши ---------- */

const hotkeyError = {};

function registerHotkeys() {
  globalShortcut.unregisterAll();
  for (const key of Object.keys(hotkeyError)) delete hotkeyError[key];

  const register = (id, accelerator, handler) => {
    if (!accelerator) return;
    try {
      const ok = globalShortcut.register(accelerator, handler);
      if (!ok) hotkeyError[id] = "занято другой программой";
    } catch {
      hotkeyError[id] = "неверное сочетание";
    }
  };

  register("toggle", settings.hotkey, toggleWindow);
  if (settings.searchHotkey && ![settings.hotkey, settings.hudHotkey].includes(settings.searchHotkey)) register("search", settings.searchHotkey, toggleSearch);
  else if (settings.searchHotkey) hotkeyError.search = "совпадает с другой клавишей оверлея";
  if (settings.hudHotkey && settings.hudHotkey !== settings.hotkey) register("hud", settings.hudHotkey, toggleHud);
  for (const bind of binds) {
    if (!bind.hotkey || bind.hotkey === settings.hotkey) {
      if (bind.hotkey) hotkeyError[bind.id] = "совпадает с клавишей оверлея";
      continue;
    }
    register(bind.id, bind.hotkey, () => runBind(bind.id));
  }
  win?.webContents.send("hotkeys:errors", hotkeyError);
}

/* ---------- отправка текста в игру (Windows) ---------- */

function sendKeysWindows(lines, { openKey, delay }) {
  return new Promise((resolve) => {
    const payload = Buffer.from(JSON.stringify({ lines, openKey, delay }), "utf8").toString("base64");
    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$p = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}')) | ConvertFrom-Json
if (-not $p.lines -or @($p.lines).Count -eq 0) { [System.Windows.Forms.SendKeys]::SendWait('^v') }
foreach ($line in $p.lines) {
  [System.Windows.Forms.Clipboard]::SetText([string]$line)
  if ($p.openKey) { [System.Windows.Forms.SendKeys]::SendWait($p.openKey); Start-Sleep -Milliseconds 150 }
  [System.Windows.Forms.SendKeys]::SendWait('^v')
  Start-Sleep -Milliseconds 120
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  Start-Sleep -Milliseconds ([int]$p.delay)
}`;
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Sta", "-WindowStyle", "Hidden", "-EncodedCommand", encoded],
      { windowsHide: true },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolve({ ok: false, error: error.message }));
    child.on("close", (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: stderr.trim().slice(0, 300) || `код ${code}` }));
  });
}

function pasteOnlyWindows() {
  return sendKeysWindows([], { openKey: "", delay: 0 });
}

/** Для биндера: «T» → «t», «Enter» → «{ENTER}», «F6» → «{F6}», одиночный символ остаётся как есть. */
function toSendKeys(key) {
  const value = String(key || "").trim();
  if (!value) return "";
  const named = { enter: "{ENTER}", tab: "{TAB}", esc: "{ESC}", escape: "{ESC}", space: " " };
  const lower = value.toLowerCase();
  if (named[lower]) return named[lower];
  if (/^f\d{1,2}$/i.test(value)) return `{${value.toUpperCase()}}`;
  return value.length === 1 ? value.replace(/[+^%~(){}[\]]/g, "{$&}") : "";
}

async function runBind(id) {
  const bind = binds.find((item) => item.id === id);
  if (!bind) return { ok: false, error: "биндер не найден" };
  if (bindRunning) return { ok: false, error: "предыдущий бинд ещё выполняется" };
  const lines = String(bind.text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { ok: false, error: "пустой бинд" };

  bindRunning = true;
  hud?.webContents.send("hud:flash", id);
  try {
    hideWindow();
    if (process.platform !== "win32") {
      clipboard.writeText(lines.join("\n"));
      return { ok: true, copiedOnly: true };
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
    const openKey = toSendKeys(bind.openKey ?? settings.openChatKey);
    const delay = Math.max(200, Number(bind.delay ?? settings.lineDelay) || 700);
    return await sendKeysWindows(lines, { openKey, delay });
  } finally {
    bindRunning = false;
  }
}

/* ---------- данные с сайта ---------- */

const dataFile = () => userFile("data-cache.json");

function emptyData() {
  return { rules: [], replies: null, repliesLocked: true, version: "", generatedAt: null, fetchedAt: null };
}

async function fetchData() {
  const base = String(settings.serverUrl || "").trim().replace(/\/+$/, "");
  if (!base) return { ok: false, error: "Оверлей не подключён: вставьте ключ из профиля на сайте (вкладка «Настройки»)" };
  const url = /^https?:\/\//i.test(base) ? base : `https://${base}`;
  try {
    const headers = { Accept: "application/json" };
    // Личный ключ открывает данные по правам администратора; общий токен остаётся для старых настроек
    if (settings.userToken) headers.Authorization = `Bearer ${String(settings.userToken).trim()}`;
    else if (settings.token) headers["X-Overlay-Token"] = settings.token.trim();
    const response = await fetch(`${url}/api/overlay/data`, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) return { ok: false, error: `Сайт ответил ${response.status}` };
    const data = await response.json();
    if (!Array.isArray(data.rules)) return { ok: false, error: "Неожиданный ответ сайта" };
    const stored = { ...emptyData(), ...data, fetchedAt: new Date().toISOString() };
    writeJson(dataFile(), stored);
    return { ok: true, data: stored };
  } catch (error) {
    const reason = error?.cause?.code || error?.name || "ошибка сети";
    return { ok: false, error: `Не удалось связаться с сайтом (${reason})` };
  }
}

function loadCached() {
  const cached = { ...emptyData(), ...readJson(dataFile(), {}) };
  if (!cached.replies) cached.replies = loadSeedReplies();
  return cached;
}

/* ---------- IPC ---------- */

function registerIpc() {
  ipcMain.handle("settings:get", () => settings);
  ipcMain.handle("connection:me", () => punishments.me());
  ipcMain.handle("punishments:state", () => punishments.getState());
  ipcMain.handle("punishments:refresh", () => punishments.poll());
  ipcMain.handle("punishments:act", (_event, payload) => punishments.act(payload));
  ipcMain.handle("punishments:create", (_event, payload) => punishments.create(payload));
  ipcMain.handle("punishments:upload", (_event, bytes, type, name) => punishments.upload(bytes, type, name));
  ipcMain.handle("settings:set", (_event, patch) => {
    const connectionChanged = ["serverUrl", "userToken"].some((key) => key in patch && patch[key] !== settings[key]);
    settings = withDerivedUrl({ ...settings, ...patch });
    if (connectionChanged) punishments.restart();
    writeJson(userFile("settings.json"), settings);
    applyWindowSettings();
    registerHotkeys();
    updateHud();
    return { settings, errors: hotkeyError };
  });
  ipcMain.handle("data:cached", () => loadCached());
  ipcMain.handle("data:refresh", async () => {
    const result = await fetchData();
    return result.ok ? { ok: true, data: { ...result.data, replies: result.data.replies ?? loadSeedReplies() } } : result;
  });
  ipcMain.handle("binds:get", () => ({ binds, errors: hotkeyError }));
  ipcMain.handle("binds:set", (_event, next) => {
    binds = Array.isArray(next) ? next : [];
    writeJson(userFile("binds.json"), binds);
    registerHotkeys();
    updateHud();
    return { errors: hotkeyError };
  });
  ipcMain.handle("bind:run", (_event, id) => runBind(id));
  ipcMain.handle("copy", async (_event, text, options = {}) => {
    clipboard.writeText(String(text ?? ""));
    const wantPaste = options.paste ?? settings.pasteOnCopy;
    const wantHide = options.hide ?? settings.hideOnCopy;
    if (wantHide || wantPaste) hideWindow();
    if (wantPaste && process.platform === "win32") {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return pasteOnlyWindows();
    }
    return { ok: true };
  });
  ipcMain.handle("window:mode", (_event, compact) => setMode(Boolean(compact)));
  ipcMain.handle("window:compact-height", (_event, extra) => {
    if (!win || !settings.compact) return;
    const height = COMPACT_HEIGHT + Math.max(0, Math.min(520, Math.round(Number(extra) || 0)));
    const bounds = win.getBounds();
    if (bounds.height !== height) win.setBounds({ ...bounds, height });
  });
  ipcMain.handle("window:hide", () => hideWindow());
  ipcMain.handle("window:quit", () => {
    quitting = true;
    app.quit();
  });
  ipcMain.handle("open-external", (_event, url) => {
    if (/^https?:\/\//.test(String(url))) shell.openExternal(String(url));
  });
  ipcMain.on("hud:size", (_event, size) => {
    if (!hud || hud.isDestroyed()) return;
    const width = Math.max(120, Math.min(600, Math.ceil(size.width)));
    const height = Math.max(24, Math.min(900, Math.ceil(size.height)));
    placeHud(width, height);
    if (settings.hud && !hud.isVisible()) hud.showInactive();
  });
  ipcMain.on("hud:lock", () => {
    settings.hudLocked = true;
    writeJson(userFile("settings.json"), settings);
    updateHud();
    win?.webContents.send("settings:changed", settings);
  });
  ipcMain.handle("connect:clipboard", () => connectFromClipboard());
  ipcMain.handle("platform", () => process.platform);
}

/* ---------- запуск ---------- */

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "build", "icon.png")).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("REGION Overlay");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Показать / скрыть", click: toggleWindow },
      { type: "separator" },
      {
        label: "Выход",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", toggleWindow);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.whenReady().then(() => {
    settings = withDerivedUrl({ ...DEFAULT_SETTINGS, ...readJson(userFile("settings.json"), {}) });
    binds = readJson(userFile("binds.json"), []);
    app.setAppUserModelId("ru.region.overlay");
    punishments = createPunishments({
      getSettings: () => settings,
      onUpdate: (payload) => win?.webContents.send("punishments:update", payload),
      onOpen: () => {
        showWindow();
        win?.webContents.send("overlay:goto", "punishments");
      },
    });
    registerIpc();
    createWindow();
    createTray();
    registerHotkeys();
    updateHud();
    if (!settings.userToken) connectFromClipboard(true);
    punishments.restart();
  });
  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    punishments?.stop();
  });
  app.on("window-all-closed", () => {});
}
