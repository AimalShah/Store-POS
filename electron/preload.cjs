const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pos', {
  getApiInfo: () => ipcRenderer.invoke('get-api-info'),
  quit: () => ipcRenderer.send('app-quit'),
  reload: () => ipcRenderer.send('app-reload'),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  printReceipt: (payload) => ipcRenderer.invoke('print-receipt', payload),
  printKot: (payload) => ipcRenderer.invoke('print-kot', payload),
  printPdf: (payload) => ipcRenderer.invoke('print-pdf', payload),
  updater: {
    getState: () => ipcRenderer.invoke('updater:get-state'),
    checkNow: () => ipcRenderer.invoke('updater:check-now'),
    download: () => ipcRenderer.invoke('updater:download'),
    restart: () => ipcRenderer.invoke('updater:restart'),
    onState: (cb) => ipcRenderer.on('updater:state', (_e, state) => cb(state)),
  },
});
