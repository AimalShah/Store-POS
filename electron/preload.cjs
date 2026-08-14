const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pos', {
  getApiInfo: () => ipcRenderer.invoke('get-api-info'),
  quit: () => ipcRenderer.send('app-quit'),
  reload: () => ipcRenderer.send('app-reload'),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  printReceipt: (payload) => ipcRenderer.invoke('print-receipt', payload),
  printKot: (payload) => ipcRenderer.invoke('print-kot', payload),
  printPdf: (payload) => ipcRenderer.invoke('print-pdf', payload),
});
