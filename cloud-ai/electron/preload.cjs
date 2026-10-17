/**
 * Preload bridge.
 *
 * Exposes a narrow, explicit API to the renderer: window controls,
 * notifications, native file dialogs, saving files, the encrypted credential
 * store and a couple of preferences. Nothing else from Node or Electron is
 * reachable from the UI.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cloudAI', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    app: process.env.CLOUD_AI_APP_VERSION || '0.1.0',
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizeChange: (callback) => {
      const listener = (_event, maximized) => callback(Boolean(maximized))
      ipcRenderer.on('window:maximized', listener)
      return () => ipcRenderer.removeListener('window:maximized', listener)
    },
  },
  notify: (payload) => ipcRenderer.invoke('notify', payload),
  pickFiles: () => ipcRenderer.invoke('file:pick'),
  saveFile: (payload) => ipcRenderer.invoke('file:save', payload),
  credentials: {
    list: () => ipcRenderer.invoke('credentials:list'),
    set: (name, value) => ipcRenderer.invoke('credentials:set', { name, value }),
    remove: (name) => ipcRenderer.invoke('credentials:remove', { name }),
  },
  preferences: {
    getLaunchAtStartup: () => ipcRenderer.invoke('preferences:get-launch-at-startup'),
    setLaunchAtStartup: (enabled) => ipcRenderer.invoke('preferences:set-launch-at-startup', enabled),
  },
  onNewChat: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('app:new-chat', listener)
    return () => ipcRenderer.removeListener('app:new-chat', listener)
  },
})
