const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("overlay", {
  getSettings: () => invoke("settings:get"),
  setSettings: (patch) => invoke("settings:set", patch),
  cachedData: () => invoke("data:cached"),
  refreshData: () => invoke("data:refresh"),
  getBinds: () => invoke("binds:get"),
  setBinds: (binds) => invoke("binds:set", binds),
  runBind: (id) => invoke("bind:run", id),
  copy: (text, options) => invoke("copy", text, options),
  setMode: (compact) => invoke("window:mode", compact),
  setCompactHeight: (extra) => invoke("window:compact-height", extra),
  hide: () => invoke("window:hide"),
  quit: () => invoke("window:quit"),
  openExternal: (url) => invoke("open-external", url),
  platform: () => invoke("platform"),
  onSettingsChanged: (callback) => ipcRenderer.on("settings:changed", (_event, settings) => callback(settings)),
  connectFromClipboard: () => ipcRenderer.invoke("connect:clipboard"),
  onConnected: (callback) => ipcRenderer.on("overlay:connected", callback),
  connectionMe: () => ipcRenderer.invoke("connection:me"),
  punishmentsState: () => ipcRenderer.invoke("punishments:state"),
  punishmentsRefresh: () => ipcRenderer.invoke("punishments:refresh"),
  punishmentsCreate: (payload) => ipcRenderer.invoke("punishments:create", payload),
  punishmentsUpload: (bytes, type, name) => ipcRenderer.invoke("punishments:upload", bytes, type, name),
  punishmentsAct: (payload) => ipcRenderer.invoke("punishments:act", payload),
  onPunishments: (callback) => ipcRenderer.on("punishments:update", (_event, payload) => callback(payload)),
  onGoto: (callback) => ipcRenderer.on("overlay:goto", (_event, tab) => callback(tab)),
  onSearch: (callback) => ipcRenderer.on("overlay:search", callback),
  onShown: (callback) => ipcRenderer.on("overlay:shown", callback),
  onHotkeyErrors: (callback) => ipcRenderer.on("hotkeys:errors", (_event, errors) => callback(errors)),
});
