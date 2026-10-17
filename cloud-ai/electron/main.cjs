/**
 * Electron desktop shell for Cloud AI.
 *
 * The main process owns everything that is specific to a desktop application:
 * a native window with its own controls, window state restoration, the system
 * tray, native file dialogs, notifications, launch-at-startup, and an encrypted
 * credential store backed by the operating system's keychain (Electron
 * safeStorage). It also supervises the Cloud AI API/UI process and passes the
 * stored credentials to it through the environment, so keys never reach the
 * renderer.
 */
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, Notification, nativeImage, screen, safeStorage, shell } =
  require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')

const REPO_ROOT = path.resolve(__dirname, '..')
const APP_URL = process.env.CLOUD_AI_APP_URL || 'http://127.0.0.1:3001'
const IS_DEV = process.env.CLOUD_AI_DESKTOP_DEV === '1' || !app.isPackaged

let mainWindow = null
let tray = null
let service = null
let isQuitting = false

/* ------------------------------ credentials ------------------------------ */

function credentialsFile() {
  return path.join(app.getPath('userData'), 'cloud-ai-credentials.json')
}

function readCredentialStore() {
  try {
    const raw = fs.readFileSync(credentialsFile())
    const encrypted = JSON.parse(raw.toString())
    const store = {}
    for (const [key, value] of Object.entries(encrypted)) {
      try {
        store[key] = safeStorage.isEncryptionAvailable()
          ? safeStorage.decryptString(Buffer.from(value, 'base64'))
          : Buffer.from(value, 'base64').toString('utf8')
      } catch {
        // Skip unreadable entries (for example a different OS user's keychain).
      }
    }
    return store
  } catch {
    return {}
  }
}

function writeCredentialStore(store) {
  const payload = {}
  for (const [key, value] of Object.entries(store)) {
    payload[key] = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(value).toString('base64')
      : Buffer.from(value, 'utf8').toString('base64')
  }
  fs.writeFileSync(credentialsFile(), JSON.stringify(payload), { mode: 0o600 })
}

/* ---------------------------- window state ---------------------------- */

function stateFile() {
  return path.join(app.getPath('userData'), 'cloud-ai-window-state.json')
}

function loadWindowState() {
  const fallback = { width: 1380, height: 900 }
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile()).toString())
    const display = screen.getPrimaryDisplay().workAreaSize
    return {
      width: Math.min(saved.width ?? fallback.width, display.width),
      height: Math.min(saved.height ?? fallback.height, display.height),
      x: saved.x,
      y: saved.y,
      maximized: Boolean(saved.maximized),
    }
  } catch {
    return { ...fallback, maximized: false }
  }
}

function saveWindowState() {
  if (!mainWindow) return
  const bounds = mainWindow.getBounds()
  fs.writeFileSync(
    stateFile(),
    JSON.stringify({ ...bounds, maximized: mainWindow.isMaximized() }),
  )
}

/* ------------------------------- service ------------------------------- */

function waitForService(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume()
        resolve(true)
      })
      request.on('error', () => {
        if (Date.now() > deadline) reject(new Error(`Cloud AI did not answer on ${url}`))
        else setTimeout(attempt, 600)
      })
    }
    attempt()
  })
}

async function startService() {
  if (process.env.CLOUD_AI_EXTERNAL_SERVICE === '1') return
  const credentials = readCredentialStore()
  const env = { ...process.env, ...credentials, CLOUD_AI_DATA_DIR: path.join(app.getPath('userData'), 'data') }
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  service = spawn(command, ['run', 'start'], {
    cwd: REPO_ROOT,
    env,
    stdio: IS_DEV ? 'inherit' : 'ignore',
  })
  service.on('exit', (code) => {
    if (!isQuitting && code !== 0) {
      dialog.showErrorBox('Cloud AI stopped', `The Cloud AI service exited with code ${code}.`)
    }
  })
  await waitForService('http://127.0.0.1:3001/api/system')
}

/* ------------------------------ application ------------------------------ */

function createWindow() {
  const state = loadWindowState()
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 940,
    minHeight: 640,
    show: false,
    title: 'Cloud AI',
    backgroundColor: '#0b1220',
    // Rounded corners and translucency where the platform supports them.
    roundedCorners: true,
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (state.maximized) mainWindow.maximize()
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.loadURL(APP_URL)
  mainWindow.on('close', (event) => {
    saveWindowState()
    if (!isQuitting && tray) {
      // Closing hides to the tray; quitting is explicit from the tray menu.
      event.preventDefault()
      mainWindow.hide()
    }
  })
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function createTray() {
  const iconPath = path.join(REPO_ROOT, 'cloud-ai', 'public', 'icon.svg')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 18, height: 18 }))
  tray.setToolTip('Cloud AI')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Cloud AI', click: () => mainWindow?.show() },
      { label: 'New chat', click: () => { mainWindow?.show(); mainWindow?.webContents.send('app:new-chat') } },
      { type: 'separator' },
      {
        label: 'Quit Cloud AI',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => mainWindow?.show())
}

/* ------------------------------- IPC bridge ------------------------------- */

function registerIpc() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('window:close', () => {
    isQuitting = true
    mainWindow?.close()
  })
  ipcMain.handle('window:is-maximized', () => Boolean(mainWindow?.isMaximized()))

  ipcMain.handle('notify', (_event, payload) => {
    if (!Notification.isSupported()) return false
    new Notification({ title: payload.title, body: payload.body }).show()
    return true
  })

  ipcMain.handle('file:pick', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
        { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'csv', 'json'] },
        { name: 'All files', extensions: ['*'] },
      ],
    })
    if (result.canceled) return []
    return result.filePaths.map((filePath) => ({
      name: path.basename(filePath),
      mime: 'application/octet-stream',
      size: fs.statSync(filePath).size,
      dataBase64: fs.readFileSync(filePath).toString('base64'),
    }))
  })

  ipcMain.handle('file:save', async (_event, payload) => {
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: payload.filename })
    if (result.canceled || !result.filePath) return { saved: false }
    if (payload.text !== undefined) {
      fs.writeFileSync(result.filePath, payload.text)
      return { saved: true, path: result.filePath }
    }
    if (payload.url) {
      const response = await fetch(payload.url)
      if (!response.ok) return { saved: false }
      fs.writeFileSync(result.filePath, Buffer.from(await response.arrayBuffer()))
      return { saved: true, path: result.filePath }
    }
    return { saved: false }
  })

  ipcMain.handle('credentials:list', () => Object.keys(readCredentialStore()))
  ipcMain.handle('credentials:set', (_event, payload) => {
    const store = readCredentialStore()
    store[payload.name] = payload.value
    writeCredentialStore(store)
    return { ok: true, secure: safeStorage.isEncryptionAvailable() }
  })
  ipcMain.handle('credentials:remove', (_event, payload) => {
    const store = readCredentialStore()
    delete store[payload.name]
    writeCredentialStore(store)
    return { ok: true }
  })

  ipcMain.handle('preferences:get-launch-at-startup', () => app.getLoginItemSettings().openAtLogin)
  ipcMain.handle('preferences:set-launch-at-startup', (_event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) })
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('platform:info', () => ({
    platform: process.platform,
    versions: { app: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
  }))
}

/* --------------------------------- boot --------------------------------- */

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => mainWindow?.show())

  app.whenReady().then(async () => {
    registerIpc()
    try {
      await startService()
    } catch (error) {
      // A desktop build with no local service still opens the UI, which then
      // explains the connection problem instead of failing silently.
      console.error('[cloud-ai] service start failed', error)
    }
    createWindow()
    createTray()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
      else mainWindow?.show()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    isQuitting = true
    saveWindowState()
    if (service && !service.killed) service.kill()
  })
}
