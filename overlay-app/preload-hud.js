const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hud", {
  onData: (callback) => ipcRenderer.on("hud:data", (_event, data) => callback(data)),
  onFlash: (callback) => ipcRenderer.on("hud:flash", (_event, id) => callback(id)),
  lock: () => ipcRenderer.send("hud:lock"),
  size: (width, height) => ipcRenderer.send("hud:size", { width, height }),
});
