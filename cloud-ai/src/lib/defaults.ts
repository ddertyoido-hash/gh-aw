/**
 * Default preferences, shared vocabulary and design tokens.
 *
 * These defaults are mirrored by the server (`server/routes/settings.ts`) so a
 * fresh install behaves identically whether the settings row exists or not.
 */

export type Theme = 'light' | 'dark' | 'system'
export type Accent = 'aurora' | 'ocean' | 'violet' | 'sunrise' | 'forest'

export interface VoiceSettings {
  autoSpeak: boolean
  voiceName: string
  rate: number
  pitch: number
  language: string
  useServerTts: boolean
}

export interface PrivacySettings {
  sendAttachments: boolean
  keepLocalOnly: boolean
}

export interface AppSettings {
  /** Shown in the sidebar account card (this app keeps everything local). */
  profileName: string
  theme: Theme
  accent: Accent
  wallpaper: WallpaperId
  wallpaperDim: number
  glassOpacity: number
  reduceMotion: boolean
  animations: boolean
  sidebarCollapsed: boolean
  rightPanelCollapsed: boolean
  launchAtStartup: boolean
  notifications: boolean
  autoTitle: boolean
  storeHistory: boolean
  defaultProvider: string
  defaultModel: string
  voice: VoiceSettings
  privacy: PrivacySettings
}

export type WallpaperId = 'mountain-lake' | 'forest' | 'cloudscape'

export const DEFAULT_SETTINGS: AppSettings = {
  profileName: 'Local workspace',
  theme: 'light',
  accent: 'aurora',
  wallpaper: 'mountain-lake',
  wallpaperDim: 18,
  glassOpacity: 68,
  reduceMotion: false,
  animations: true,
  sidebarCollapsed: false,
  rightPanelCollapsed: false,
  launchAtStartup: false,
  notifications: true,
  autoTitle: true,
  storeHistory: true,
  defaultProvider: 'openai',
  defaultModel: 'gpt-4.1-mini',
  voice: {
    autoSpeak: false,
    voiceName: '',
    rate: 1,
    pitch: 1,
    language: 'en-US',
    useServerTts: false,
  },
  privacy: {
    sendAttachments: true,
    keepLocalOnly: false,
  },
}

export const WALLPAPERS: Array<{ id: WallpaperId; name: string; description: string }> = [
  {
    id: 'mountain-lake',
    name: 'Mountain lake',
    description: 'Golden hour over a still alpine lake.',
  },
  {
    id: 'forest',
    name: 'Forest landscape',
    description: 'Layered pines in cool morning mist.',
  },
  {
    id: 'cloudscape',
    name: 'Soft cloudscape',
    description: 'Open sky with drifting clouds and warm light.',
  },
]

export const ACCENTS: Array<{ id: Accent; name: string; colors: [string, string, string, string] }> = [
  { id: 'aurora', name: 'Aurora', colors: ['#22d3ee', '#3b82f6', '#8b5cf6', '#14b8a6'] },
  { id: 'ocean', name: 'Ocean', colors: ['#38bdf8', '#0ea5e9', '#2563eb', '#0891b2'] },
  { id: 'violet', name: 'Violet', colors: ['#a78bfa', '#8b5cf6', '#6366f1', '#c026d3'] },
  { id: 'sunrise', name: 'Sunrise', colors: ['#fbbf24', '#fb923c', '#f472b6', '#a855f7'] },
  { id: 'forest', name: 'Forest', colors: ['#34d399', '#10b981', '#0d9488', '#65a30d'] },
]

export interface NavItem {
  id: string
  label: string
  path: string
  icon: string
  hint: string
}

/** Sidebar navigation - every entry maps to a real route. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', path: '/', icon: 'home', hint: 'Prompt composer and quick actions' },
  { id: 'chat', label: 'Chat', path: '/chat', icon: 'message', hint: 'Conversations with streaming answers' },
  { id: 'create', label: 'Create', path: '/create', icon: 'wand', hint: 'Write emails, articles and documents' },
  { id: 'images', label: 'Images', path: '/images', icon: 'image', hint: 'Image generation studio' },
  { id: 'voice', label: 'Voice', path: '/voice', icon: 'mic', hint: 'Talk to Cloud AI and hear replies' },
  { id: 'research', label: 'Research', path: '/research', icon: 'telescope', hint: 'Research topics into briefings' },
  { id: 'agents', label: 'Agents', path: '/agents', icon: 'robot', hint: 'Specialised assistants you control' },
  { id: 'history', label: 'History', path: '/history', icon: 'history', hint: 'Chats, images, documents and research' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'settings', hint: 'Appearance, providers, voice, privacy' },
]

export interface QuickAction {
  id: string
  label: string
  prompt: string
  mode: 'chat' | 'create' | 'research' | 'summarize'
  icon: string
  description: string
}

export const ACTION_CARDS: Array<QuickAction & { accent: string }> = [
  {
    id: 'create-image',
    label: 'Create Image',
    icon: 'image',
    description: 'Generate original images from a text prompt.',
    prompt: '',
    mode: 'chat',
    accent: 'from-cyan-400/80 to-blue-500/80',
  },
  {
    id: 'write',
    label: 'Write Anything',
    icon: 'pen',
    description: 'Emails, articles, stories and professional documents.',
    prompt: 'Help me write ',
    mode: 'create',
    accent: 'from-violet-400/80 to-fuchsia-500/80',
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: 'list',
    description: 'Summarize documents, webpages and long text.',
    prompt: 'Summarize the following:\n\n',
    mode: 'summarize',
    accent: 'from-teal-400/80 to-emerald-500/80',
  },
  {
    id: 'research',
    label: 'Research',
    icon: 'telescope',
    description: 'Research a topic and organise useful findings.',
    prompt: 'Research ',
    mode: 'research',
    accent: 'from-blue-400/80 to-indigo-500/80',
  },
]

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'quick-image',
    label: 'Generate image',
    icon: 'image',
    description: 'Open the studio with a fresh prompt.',
    prompt: 'A serene alpine lake at golden hour, mountains behind, soft clouds, cinematic light',
    mode: 'chat',
  },
  {
    id: 'quick-email',
    label: 'Write email',
    icon: 'mail',
    description: 'Draft a professional email in seconds.',
    prompt: 'Write a short, friendly follow-up email to a client who has not replied in a week.',
    mode: 'create',
  },
  {
    id: 'quick-analyze',
    label: 'Analyze file',
    icon: 'paperclip',
    description: 'Attach a file and ask for an analysis.',
    prompt: 'Analyze the attached file and summarise the most important points.',
    mode: 'chat',
  },
  {
    id: 'quick-brainstorm',
    label: 'Brainstorm ideas',
    icon: 'sparkles',
    description: 'Generate ten distinct directions.',
    prompt: 'Brainstorm 10 distinct ideas for ',
    mode: 'create',
  },
]

export const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'Ctrl/Cmd + N', action: 'New chat' },
  { keys: 'Ctrl/Cmd + K', action: 'Focus the prompt composer' },
  { keys: 'Ctrl/Cmd + Shift + I', action: 'Open the Images studio' },
  { keys: 'Ctrl/Cmd + ,', action: 'Open Settings' },
  { keys: 'Ctrl/Cmd + B', action: 'Collapse or expand the sidebar' },
  { keys: 'Ctrl/Cmd + Shift + S', action: 'Stop the current response' },
  { keys: 'Escape', action: 'Close dialogs, menus and stop supported operations' },
]

export const UNIT_LABELS: Record<string, string> = {
  chat: 'Chat message',
  summarize: 'Summarize',
  research: 'Research run',
  image: 'Image generation',
  voice: 'Voice minute',
}
