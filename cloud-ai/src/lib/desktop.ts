/**
 * Desktop integration layer.
 *
 * Everything desktop-specific is behind this module. When Cloud AI runs inside
 * the Electron shell (`electron/`), `window.cloudAI` is present and native file
 * pickers, save dialogs, notifications, window controls and launch-at-startup
 * are used. In a plain browser the same functions fall back to standard web
 * APIs, so the interface behaves consistently in both environments.
 */

export interface DesktopFile {
  name: string
  mime: string
  size: number
  /** base64 payload (files are read in the main process) */
  dataBase64: string
}

export interface CloudDesktopBridge {
  isDesktop: true
  platform: string
  versions: { app: string; electron: string; chrome: string; node: string }
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximizeChange: (callback: (maximized: boolean) => void) => () => void
  }
  notify: (payload: { title: string; body: string }) => Promise<boolean>
  saveFile: (payload: { filename: string; url?: string; text?: string }) => Promise<{ saved: boolean; path?: string }>
  pickFiles: () => Promise<DesktopFile[]>
  credentials: {
    list: () => Promise<string[]>
    set: (name: string, value: string) => Promise<{ ok: boolean; secure: boolean }>
    remove: (name: string) => Promise<{ ok: boolean }>
  }
  preferences: {
    getLaunchAtStartup: () => Promise<boolean>
    setLaunchAtStartup: (enabled: boolean) => Promise<boolean>
  }
}

declare global {
  interface Window {
    cloudAI?: CloudDesktopBridge
  }
}

export const desktop = window.cloudAI

export const isDesktop = () => Boolean(desktop?.isDesktop)

export const desktopPlatform = () => desktop?.platform ?? navigator.platform ?? 'web'

/** True when the browser exposes the Web Speech API (Chromium-based). */
export const supportsBrowserSpeech = () =>
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

export const supportsSpeechSynthesis = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window

export async function notify(title: string, body: string): Promise<void> {
  if (desktop) {
    await desktop.notify({ title, body })
    return
  }
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission()
    } catch {
      return
    }
  }
  if (Notification.permission === 'granted') new Notification(title, { body })
}

export async function pickFiles(): Promise<File[]> {
  if (desktop) {
    const picked = await desktop.pickFiles()
    return picked.map((file) => {
      const binary = atob(file.dataBase64)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
      return new File([bytes], file.name, { type: file.mime })
    })
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*,application/pdf,text/*,.md,.csv,.json'
    input.onchange = () => resolve(input.files ? Array.from(input.files) : [])
    input.oncancel = () => resolve([])
    input.click()
  })
}

/** Saves a generated image or text document to disk. */
export async function saveFile(options: { filename: string; url?: string; text?: string }): Promise<boolean> {
  if (desktop) {
    const result = await desktop.saveFile(options)
    return result.saved
  }
  if (options.text !== undefined) {
    const blob = new Blob([options.text], { type: 'text/plain' })
    triggerDownload(blob, options.filename)
    return true
  }
  if (options.url) {
    const response = await fetch(options.url)
    if (!response.ok) return false
    triggerDownload(await response.blob(), options.filename)
    return true
  }
  return false
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
