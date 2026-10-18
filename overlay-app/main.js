const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen, Tray, Menu, nativeImage, shell, dialog, safeStorage } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { createPunishments, quickTargets } = require("./punishments");
const { createUpdater } = require("./updater");
const { buildBackup, parseBackup } = require("./backup");
const { createActionLog } = require("./actlog");
const { normalizeOrigin, originFromKey, findKey, isHostTrusted } = require("./site-key");
const { MASK, seal, unseal, publicSettings, sanitizePatch } = require("./secure-settings");

const DEFAULT_SETTINGS = {
  serverUrl: "",
  token: "",
  hotkey: "Alt+R",
  searchHotkey: "Alt+S",
  userToken: "",
  notifyPunishments: true,
  punClaimHotkey: "Alt+Q",
  punCopyHotkey: "Alt+W",
  punIssueHotkey: "Alt+E",
  punOpenHotkey: "Alt+P",
  autoUpdate: true,
  notifyMuted: false,
  notifySound: true,
  notifyVolume: 0.6,
  notifyMode: "overlay",
  notifyCorner: "top-right",
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
  hudBg: true,
  density: "comfortable",
  hudBlockOpacity: 1,
  hudHotkey: "Alt+H",
  hudLocked: true,
  hudPos: null,
  lockWindow: false,
  compact: false,
  compactBounds: null,
};

const COMPACT_WIDTH = 760;
// 8 (отступ сверху) + 64 (строка) + 24 (место под тень)
const COMPACT_HEIGHT = 96;

let win = null;
let hud = null;
let notifyWin = null;
let notifyReady = false;
let notifyPending = [];
let notifyHeight = 120;
let punishments = null;
let updater = null;
let actionLog = null;
const updateAnnounced = new Set();
let hudSize = { width: 260, height: 40 };
let hudSaveTimer = null;
let tray = null;
let settings = { ...DEFAULT_SETTINGS };
let binds = [];
let bindRunning = false;
let quitting = false;

/** Настройки на диск: ключ доступа шифруется системой (DPAPI), в открытом виде в settings.json его нет. */
function writeSettings() {
  writeJson(userFile("settings.json"), seal(settings, safeStorage));
}

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
    minHeight: settings.compact ? 60 : 360,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    show: false,
    skipTaskbar: true,
    resizable: false,
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
  win.webContents.setVisualZoomLevelLimits(1, 1);
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
    writeSettings();
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
    win.setMinimumSize(360, 60);
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
  writeSettings();
  return settings;
}

function applyWindowSettings() {
  if (!win) return;
  win.setOpacity(Math.min(1, Math.max(0.3, Number(settings.opacity) || 0.96)));
  // Уровень «screen-saver» держит окно выше игры в режиме «в окне без рамки».
  win.setAlwaysOnTop(Boolean(settings.alwaysOnTop), "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setMovable(!settings.lockWindow);
  win.setResizable(false);
}

function showWindow() {
  if (!win) return;
  applyWindowSettings();
  if (!settings.userToken) connectFromClipboard(true).catch(() => undefined);
  win.show();
  win.focus();
  win.webContents.send("overlay:shown");
}

/* ---------- автоподключение к сайту: «код подключения» из буфера обмена ---------- */

/* ---------- подключение: один ключ из профиля на сайте ---------- */

const KEY_PATTERN = /rgo_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/;

/** Адрес всегда берётся из ключа (и только https); без ключа остаётся лишь безопасный адрес из старых настроек. */
function withDerivedUrl(next) {
  const origin = originFromKey(next.userToken);
  return { ...next, serverUrl: origin || normalizeOrigin(next.serverUrl) };
}

/** Сайты, к которым разрешено подключаться. Пустой список: любой https-адрес, но с подтверждением пользователя. */
const trustedHosts = (() => {
  const list = readJson(path.join(__dirname, "trusted-hosts.json"), {}).hosts;
  return Array.isArray(list) ? list.filter((host) => typeof host === "string") : [];
})();

/** Открытый ключ проверки подписи обновлений. Нет файла: обновления отключены. */
const updatePublicKey = (() => {
  try {
    return fs.readFileSync(path.join(__dirname, "update-key.pub"), "utf8").trim() || null;
  } catch {
    return null;
  }
})();

let connecting = false;

/**
 * Подключение по ключу. Ключ из буфера обмена мог положить кто угодно, а сайт из ключа получает доступ к данным и
 * обновлениям программы, поэтому новый сайт всегда подтверждается пользователем.
 */
async function applyKey(key, { auto = false } = {}) {
  const origin = originFromKey(key);
  if (!origin) return { ok: false, error: "Ключ не подошёл: адрес сайта в нём должен начинаться с https://" };
  const host = new URL(origin).host;
  if (!isHostTrusted(origin, trustedHosts)) return { ok: false, error: `Сайт ${host} не входит в список разрешённых для этой сборки` };
  if (connecting) return { ok: false, canceled: true };
  connecting = true;
  try {
    if (origin !== settings.serverUrl) {
      const parent = win && !win.isDestroyed() && win.isVisible() ? win : undefined;
      const answer = await dialog.showMessageBox(parent, {
        type: "question",
        title: "Подключение оверлея",
        message: `Подключить оверлей к сайту ${host}?`,
        detail: `${auto ? "Ключ найден в буфере обмена. " : ""}С этого сайта программа будет получать правила, ответы, заявки и обновления. Подключайтесь только к адресу вашего сайта.`,
        buttons: ["Подключить", "Отмена"],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      if (answer.response !== 0) return { ok: false, canceled: true };
    }
    settings = { ...settings, userToken: String(key).trim(), serverUrl: origin, token: "" };
    writeSettings();
    punishments?.restart();
    win?.webContents.send("settings:changed", publicSettings(settings));
    win?.webContents.send("overlay:connected");
    return { ok: true };
  } finally {
    connecting = false;
  }
}

function disconnectSite() {
  settings = { ...settings, userToken: "", serverUrl: "", token: "" };
  writeSettings();
  punishments?.restart();
}

/** auto: ключ из буфера обмена предлагается сам, только если ключа ещё нет. */
async function connectFromClipboard(auto = false) {
  const found = findKey(clipboard.readText());
  if (!found || !originFromKey(found)) return { ok: false };
  if (auto && settings.userToken) return { ok: false };
  return applyKey(found, { auto });
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
      writeSettings();
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
    bg: settings.hudBg !== false,
    blockOpacity: Math.min(1, Math.max(0.2, Number(settings.hudBlockOpacity) || 1)),
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
  writeSettings();
  updateHud();
  win?.webContents.send("settings:changed", publicSettings(settings));
}

/* ---------- интерактивные уведомления о наказаниях ---------- */

const NOTIFY_WIDTH = 412;

function createNotify() {
  notifyReady = false;
  notifyWin = new BrowserWindow({
    width: NOTIFY_WIDTH,
    height: notifyHeight,
    frame: false,
    transparent: true,
    hasShadow: false,
    show: false,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, "preload-notify.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: "no-user-gesture-required" },
  });
  notifyWin.setAlwaysOnTop(true, "screen-saver");
  notifyWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  notifyWin.loadFile(path.join(__dirname, "src", "notify.html"));
  notifyWin.webContents.on("did-finish-load", () => {
    notifyReady = true;
    for (const event of notifyPending.splice(0)) notifyWin?.webContents.send("notify:push", event);
  });
  notifyWin.on("closed", () => {
    notifyWin = null;
    notifyReady = false;
  });
}

function placeNotify(height) {
  if (!notifyWin || notifyWin.isDestroyed()) return;
  notifyHeight = Math.max(40, Math.min(900, Math.round(height)));
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const margin = 10;
  const [vertical, horizontal] = String(settings.notifyCorner || "top-right").split("-");
  const x = horizontal === "left" ? area.x + margin : area.x + area.width - NOTIFY_WIDTH - margin;
  const y = vertical === "bottom" ? area.y + area.height - notifyHeight - margin : area.y + margin;
  notifyWin.setBounds({ x, y, width: NOTIFY_WIDTH, height: notifyHeight });
}

function pushNotify(event) {
  if (!notifyWin) createNotify();
  // Скрытое окно не рисует кадры и не пришлёт размер, поэтому показываем его сразу
  if (!notifyWin.isVisible()) {
    placeNotify(notifyHeight);
    notifyWin.showInactive();
  }
  // Свой мотив для каждого события; подтверждения быстрых клавиш (quiet) молчат
  const sound = event.quiet || settings.notifySound === false ? null : event.kind === "mine" ? (event.tone === "ok" ? "ok" : event.tone === "bad" ? "bad" : "info") : "new";
  const payload = { ...event, sound, volume: Number.isFinite(Number(settings.notifyVolume)) ? Number(settings.notifyVolume) : 0.6 };
  if (notifyReady) notifyWin.webContents.send("notify:push", payload);
  else notifyPending.push(payload);
}

/** Карточка об обновлении: «готово к установке» или (если автозагрузка выключена) «доступна версия». */
function announceUpdate(state) {
  const key = `${state.latest}:${state.status}`;
  if (updateAnnounced.has(key)) return;
  updateAnnounced.add(key);
  const ready = state.status === "ready";
  pushNotify({
    id: `upd-${key}`, kind: "update", action: ready ? "install" : "download", quiet: true,
    title: ready ? `Обновление ${state.latest} готово` : `Доступна версия ${state.latest}`,
    body: state.notes || (ready ? "Установится после перезапуска. Можно сделать это сейчас." : "Скачайте обновление, чтобы установить его."),
  });
}

function resolveNotify(ids) {
  if (notifyWin && notifyReady) notifyWin.webContents.send("notify:resolve", ids);
}

/** Пробная карточка: имитирует цепочку шагов без обращения к сайту. */
let demoStep = 0;
function demoAssigned(action, note) {
  if (action === "claim") { demoStep = 0; return { id: "__test", number: 0, needsDecision: true, command: null, copied: false }; }
  if (action === "reject") return null;
  if (action === "approve") { demoStep = 1; return { id: "__test", number: 0, needsDecision: false, command: "/jail 5476 60 ОП 1.19", copied: false }; }
  if (action === "copycmd") { demoStep = 2; return { id: "__test", number: 0, needsDecision: false, command: "/jail 5476 60 ОП 1.19", copied: true }; }
  return null;
}

function testNotify() {
  pushNotify({
    id: `test-${Date.now()}`, kind: "queue", canClaim: true,
    title: "Заявка на наказание №0",
    item: { id: "__test", number: 0, kind: "Деморган", duration: "60 мин", staticId: "5476", requester: "Проверка", rules: ["ОП 1.19", "ОП 3.11"], evidenceCount: 2, repeats: 2, createdAt: new Date().toISOString() },
  });
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
  const taken = new Set([settings.hotkey, settings.searchHotkey, settings.hudHotkey, ...binds.map((bind) => bind.hotkey)].filter(Boolean));
  for (const [id, key, handler] of [
    ["punClaim", settings.punClaimHotkey, hotkeyClaim],
    ["punCopy", settings.punCopyHotkey, hotkeyCopy],
    ["punIssue", settings.punIssueHotkey, hotkeyIssue],
    ["punOpen", settings.punOpenHotkey, hotkeyOpenPunishments],
  ]) {
    if (!key) continue;
    if (taken.has(key)) { hotkeyError[id] = "совпадает с другой клавишей оверлея"; continue; }
    taken.add(key);
    register(id, key, handler);
  }
  win?.webContents.send("hotkeys:errors", hotkeyError);
}

/* ---------- быстрые клавиши наказаний (работают в игре, ответ приходит карточкой) ---------- */

function quickSay(title, body, tone = "info") {
  pushNotify({ id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind: "mine", tone, title, body, quiet: true });
}

async function hotkeyClaim() {
  await punishments?.poll(); // решение принимается по свежим данным, а не по опросу 15-секундной давности
  const target = quickTargets(punishments?.getState().data);
  if (!punishments?.getState().configured) return quickSay("Наказания не подключены", "Подключите ключ в настройках оверлея", "bad");
  if (!target.review) return quickSay("Нет доступа", "У вашей роли нет права рассматривать заявки", "bad");
  if (!target.claim) return quickSay("Очередь пуста", "Новых заявок нет");
  const item = target.claim;
  const result = await punishments.act({ id: item.id, action: "claim" });
  if (!result.ok) return quickSay("Не удалось взять заявку", result.error || "", "bad");
  clipboard.writeText(String(item.staticId));
  quickSay(`Заявка №${item.number} ваша`, `${item.kind}, ${item.duration}. Static ID ${item.staticId} скопирован`, "ok");
}

async function hotkeyCopy() {
  await punishments?.poll();
  const target = quickTargets(punishments?.getState().data);
  if (!target.copy) {
    return target.waiting
      ? quickSay("Команды ещё нет", `Заявка №${target.waiting.number} ждёт решения: одобрите её в оверлее`, "bad")
      : quickSay("Нет заявок в работе", "Возьмите заявку из очереди");
  }
  const item = target.copy;
  clipboard.writeText(String(item.command));
  if (!item.copied) await punishments.act({ id: item.id, action: "copied" });
  quickSay(`Команда скопирована (№${item.number})`, item.command, "ok");
}

async function hotkeyIssue() {
  await punishments?.poll();
  const target = quickTargets(punishments?.getState().data);
  if (!target.issue) {
    return target.unissued
      ? quickSay("Сначала скопируйте команду", `Заявка №${target.unissued.number}`, "bad")
      : quickSay("Нечего отмечать", "Нет заявки с готовой командой");
  }
  const item = target.issue;
  const result = await punishments.act({ id: item.id, action: "issue" });
  if (result.ok) quickSay(`Наказание выдано (№${item.number})`, `${item.kind}, ID ${item.staticId}`, "ok");
  else quickSay("Не удалось отметить", result.error || "", "bad");
}

function hotkeyOpenPunishments() {
  showWindow();
  win?.webContents.send("overlay:goto", "punishments");
}

/* ---------- отправка текста в игру (Windows) ---------- */

function sendKeysWindows(lines, { openKey, delay, autoEnter = true }) {
  return new Promise((resolve) => {
    const payload = Buffer.from(JSON.stringify({ lines, openKey, delay, autoEnter }), "utf8").toString("base64");
    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$p = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}')) | ConvertFrom-Json
if (-not $p.lines -or @($p.lines).Count -eq 0) { [System.Windows.Forms.SendKeys]::SendWait('^v') }
$total = @($p.lines).Count
$done = 0
foreach ($line in $p.lines) {
  $done++
  [System.Windows.Forms.Clipboard]::SetText([string]$line)
  if ($p.openKey) { [System.Windows.Forms.SendKeys]::SendWait($p.openKey); Start-Sleep -Milliseconds 150 }
  [System.Windows.Forms.SendKeys]::SendWait('^v')
  Start-Sleep -Milliseconds 120
  # Без автоввода Enter нажимается только между строками, последняя остаётся в поле чата
  if ($p.autoEnter -or $done -lt $total) {
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    Start-Sleep -Milliseconds ([int]$p.delay)
  }
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
    return await sendKeysWindows(lines, { openKey, delay, autoEnter: bind.autoEnter !== false });
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
  const base = normalizeOrigin(settings.serverUrl);
  if (!base) return { ok: false, error: "Оверлей не подключён: вставьте ключ из профиля на сайте (вкладка «Настройки»)" };
  const url = base;
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
  ipcMain.handle("settings:get", () => publicSettings(settings));
  ipcMain.handle("connection:me", () => punishments.me());
  ipcMain.handle("punishments:state", () => punishments.getState());
  ipcMain.handle("punishments:refresh", () => punishments.poll());
  ipcMain.handle("punishments:act", (_event, payload) => punishments.act(payload));
  ipcMain.handle("punishments:log", () => actionLog.list());
  ipcMain.handle("punishments:log-clear", () => { actionLog.clear(); return true; });
  ipcMain.handle("punishments:create", (_event, payload) => punishments.create(payload));
  ipcMain.handle("punishments:upload", (_event, bytes, type, name) => punishments.upload(bytes, type, name));
  ipcMain.handle("settings:set", async (_event, patch) => {
    const input = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
    let error = null;
    // Подключение меняется только здесь и только через проверку ключа; окну достаточно маски вместо настоящего ключа
    if ("userToken" in input) {
      const value = String(input.userToken ?? "").trim();
      if (value === "") disconnectSite();
      else if (value !== MASK) {
        const result = await applyKey(value);
        if (!result.ok && !result.canceled) error = result.error;
      }
    }
    settings = { ...settings, ...sanitizePatch(input, DEFAULT_SETTINGS) };
    writeSettings();
    applyWindowSettings();
    registerHotkeys();
    updateHud();
    if (notifyWin?.isVisible()) placeNotify(notifyHeight);
    return { settings: publicSettings(settings), errors: hotkeyError, error };
  });
  ipcMain.handle("backup:export", async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const target = await dialog.showSaveDialog(win, { title: "Сохранить настройки", defaultPath: `region-overlay-${stamp}.json`, filters: [{ name: "JSON", extensions: ["json"] }] });
    if (target.canceled || !target.filePath) return { ok: false, canceled: true };
    try {
      fs.writeFileSync(target.filePath, JSON.stringify(buildBackup(settings, binds, app.getVersion()), null, 2));
      return { ok: true, path: target.filePath };
    } catch (error) {
      return { ok: false, error: `Не удалось записать файл: ${error.message}` };
    }
  });
  ipcMain.handle("backup:import", async () => {
    const source = await dialog.showOpenDialog(win, { title: "Загрузить настройки", properties: ["openFile"], filters: [{ name: "JSON", extensions: ["json"] }] });
    if (source.canceled || !source.filePaths[0]) return { ok: false, canceled: true };
    let text;
    try {
      const stat = fs.statSync(source.filePaths[0]);
      if (stat.size > 2 * 1024 * 1024) return { ok: false, error: "Файл слишком большой для копии настроек" };
      text = fs.readFileSync(source.filePaths[0], "utf8");
    } catch (error) {
      return { ok: false, error: `Не удалось прочитать файл: ${error.message}` };
    }
    const parsed = parseBackup(text, DEFAULT_SETTINGS);
    if (!parsed.ok) return parsed;
    settings = withDerivedUrl({ ...settings, ...sanitizePatch(parsed.settings, DEFAULT_SETTINGS) });
    writeSettings();
    if (parsed.binds) {
      binds = parsed.binds;
      writeJson(userFile("binds.json"), binds);
    }
    applyWindowSettings();
    registerHotkeys();
    updateHud();
    return { ok: true, settings: publicSettings(settings), errors: hotkeyError, binds: parsed.binds ? parsed.binds.length : null, skipped: parsed.skipped };
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
  // Окно уведомлений не берёт фокус, но для ввода причины отказа его нужно включить, а после ввода вернуть обратно
  ipcMain.on("notify:focusable", (_event, on) => {
    if (!notifyWin || notifyWin.isDestroyed()) return;
    notifyWin.setFocusable(Boolean(on));
    if (on) notifyWin.focus();
  });
  ipcMain.on("notify:size", (_event, { height }) => {
    if (!notifyWin || notifyWin.isDestroyed()) return;
    if (!height) { notifyWin.hide(); return; }
    placeNotify(height);
    if (!notifyWin.isVisible()) notifyWin.showInactive();
  });
  ipcMain.handle("notify:action", async (_event, { action, item, note } = {}) => {
    const id = typeof item?.id === "string" ? item.id : "";
    // Шаги решения прямо из карточки: взять → одобрить/отклонить → скопировать команду → «Выдал».
    // После каждого шага возвращаем свежую заявку «в работе», чтобы карточка показала следующую кнопку.
    const assignedNow = () => (punishments.getState().data?.assigned || []).find((entry) => entry.id === id) || null;
    if (["claim", "approve", "reject", "issue", "copycmd"].includes(action)) {
      if (!id) return { ok: false, error: "Нет заявки" };
      if (id === "__test") return { ok: true, assigned: demoAssigned(action, note) };
      if (action === "copycmd") {
        const current = assignedNow();
        if (!current?.command) return { ok: false, error: "Команды ещё нет" };
        clipboard.writeText(String(current.command));
        if (!current.copied) await punishments.act({ id, action: "copied" });
        return { ok: true, assigned: assignedNow() };
      }
      const result = await punishments.act({ id, action, ...(action === "reject" ? { note: String(note || "").slice(0, 300) } : {}) });
      return result.ok ? { ok: true, assigned: assignedNow() } : result;
    }
    if (action === "copy") {
      if (item?.staticId) clipboard.writeText(String(item.staticId));
      return { ok: true };
    }
    if (action === "update-install") {
      const result = updater.install({ restart: true });
      if (result.ok) { quitting = true; setTimeout(() => app.quit(), 150); }
      return result;
    }
    if (action === "update-download") { updater.download(); return { ok: true }; }
    if (action === "open") {
      showWindow();
      win?.webContents.send("overlay:goto", "punishments");
      return { ok: true };
    }
    return { ok: false };
  });
  ipcMain.handle("updater:state", () => updater.getState());
  ipcMain.handle("updater:check", () => updater.check({ manual: true }));
  ipcMain.handle("updater:download", () => updater.download());
  ipcMain.handle("updater:install", () => {
    const result = updater.install({ restart: true });
    if (result.ok) { quitting = true; setTimeout(() => app.quit(), 150); }
    return result;
  });
  ipcMain.handle("notify:test", () => { testNotify(); return { ok: true }; });
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
    writeSettings();
    updateHud();
    win?.webContents.send("settings:changed", publicSettings(settings));
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
    const loaded = unseal(readJson(userFile("settings.json"), {}), safeStorage, DEFAULT_SETTINGS);
    settings = withDerivedUrl(loaded.settings);
    // Открытый ключ из старой версии переписывается в зашифрованном виде
    if (loaded.migrated) writeSettings();
    binds = readJson(userFile("binds.json"), []);
    app.setAppUserModelId("ru.region.overlay");
    actionLog = createActionLog({ read: () => readJson(userFile("actions.json"), []), write: (list) => writeJson(userFile("actions.json"), list) });
    punishments = createPunishments({
      getSettings: () => settings,
      log: actionLog,
      onUpdate: (payload) => win?.webContents.send("punishments:update", payload),
      onOpen: () => {
        showWindow();
        win?.webContents.send("overlay:goto", "punishments");
      },
      onNotify: pushNotify,
      onResolve: resolveNotify,
    });
    // Portable-версия сама знает путь к своему .exe; в обычной сборке (установщик) и в разработке автоустановки нет
    const portableTarget = process.env.PORTABLE_EXECUTABLE_FILE || null;
    updater = createUpdater({
      publicKey: updatePublicKey,
      getSettings: () => settings,
      getVersion: () => app.getVersion(),
      getTarget: () => portableTarget,
      getDir: () => (portableTarget ? path.dirname(portableTarget) : path.join(app.getPath("userData"), "updates")),
      canInstall: app.isPackaged && process.platform === "win32" && Boolean(portableTarget),
      onState: (state) => {
        win?.webContents.send("updater:state", state);
        if (state.status === "available" && state.canInstall && settings.autoUpdate === false) announceUpdate(state);
      },
      onReady: (state) => announceUpdate(state),
    });
    registerIpc();
    createWindow();
    createTray();
    registerHotkeys();
    updateHud();
    if (!settings.userToken) connectFromClipboard(true).catch(() => undefined);
    punishments.restart();
    updater.start();
  });
  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    punishments?.stop();
    updater?.stop();
    updater?.applyOnQuit(); // скачанное обновление ставится при выходе
  });
  app.on("window-all-closed", () => {});
}
