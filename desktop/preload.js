// The failure window needs exactly two actions and nothing else. Everything the
// app page runs stays without a preload.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("niyam", {
  retry: () => ipcRenderer.send("niyam:retry"),
  quit: () => ipcRenderer.send("niyam:quit"),
});
