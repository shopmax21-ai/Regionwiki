const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notify", {
  onPush: (callback) => ipcRenderer.on("notify:push", (_event, data) => callback(data)),
  onResolve: (callback) => ipcRenderer.on("notify:resolve", (_event, ids) => callback(ids)),
  action: (action, item, note) => ipcRenderer.invoke("notify:action", { action, item, note }),
  focusable: (on) => ipcRenderer.send("notify:focusable", Boolean(on)),
  size: (height) => ipcRenderer.send("notify:size", { height }),
});
