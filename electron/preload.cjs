const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pos', {
  getApiInfo: () => ipcRenderer.invoke('get-api-info'),
  quit: () => ipcRenderer.send('app-quit'),
  reload: () => ipcRenderer.send('app-reload'),
});
