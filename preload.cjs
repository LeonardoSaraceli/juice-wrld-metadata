const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("juice", {
  addMusic: () => ipcRenderer.invoke("music:add"),
  removeMusic: (paths) => ipcRenderer.invoke("music:remove", paths),
  chooseCover: () => ipcRenderer.invoke("cover:choose"),
  processTracks: (tracks) => ipcRenderer.invoke("tracks:process", tracks),
  searchCatalog: (query, page = 1, filters = {}) => ipcRenderer.invoke("catalog:search", { query, page, filters }),
  catalogFilterOptions: () => ipcRenderer.invoke("catalog:filter-options"),
  searchCovers: (query, page = 1) => ipcRenderer.invoke("covers:search", { query, page }),
  coverThumbnail: (path) => ipcRenderer.invoke("covers:thumbnail", path),
  coverPreview: (path) => ipcRenderer.invoke("covers:preview", path),
  searchEditorCovers: (query, page = 1) => ipcRenderer.invoke("editor:covers-search", { query, page }),
  applyEditorCover: (payload) => ipcRenderer.invoke("editor:cover-apply", payload),
  searchOriginals: (query, page = 1) => ipcRenderer.invoke("editor:originals-search", { query, page }),
  compareOriginal: (localPath, original) => ipcRenderer.invoke("editor:original-compare", { localPath, original }),
  searchTracker: (query) => ipcRenderer.invoke("tracker:search", query),
  findLyrics: (track) => ipcRenderer.invoke("lyrics:find", track),
  getLyricsCandidate: (id) => ipcRenderer.invoke("lyrics:get", id),
  scanQuality: () => ipcRenderer.invoke("quality:scan"),
  cancelQualityScan: () => ipcRenderer.invoke("quality:cancel"),
  openInSpek: (filePath) => ipcRenderer.invoke("quality:open-spek", filePath),
  showQualityFile: (filePath) => ipcRenderer.invoke("quality:show-file", filePath),
  downloadSong: (song) => ipcRenderer.invoke("catalog:download", song),
  downloadQueue: (songs) => ipcRenderer.invoke("catalog:download-queue", songs),
  openExternal: (url) => ipcRenderer.invoke("external:open", url),
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("tracks:progress", listener);
    return () => ipcRenderer.removeListener("tracks:progress", listener);
  },
  onQueueProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("catalog:queue-progress", listener);
    return () => ipcRenderer.removeListener("catalog:queue-progress", listener);
  },
  onQualityProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("quality:progress", listener);
    return () => ipcRenderer.removeListener("quality:progress", listener);
  }
});
