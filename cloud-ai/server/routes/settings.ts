/**
 * Settings, providers, plans, usage, activity and local data management.
 *
 * Provider credentials are never read from or written to these routes: the
 * client can only see whether a provider is configured and set non-secret
 * options such as a self-hosted base URL.
 */
import { Router } from 'express'
import { AGENT_TOOLS } from '../agents.js'
import { DATA_DIR, db, getSetting, listActivity, patchSettings } from '../db.js'
import { ADAPTERS, getProvider, listProviders } from '../providers/index.js'
import { HttpError } from '../types.js'
import { COSTS, PLANS, syncPeriod, usageHistory } from '../units.js'

export const settingsRouter = Router()

const APP_VERSION = '0.1.0'

/** Defaults mirror `src/lib/defaults.ts` in the UI so both sides agree. */
const SETTINGS_DEFAULTS = {
  profileName: 'Local workspace',
  theme: 'light' as const,
  accent: 'aurora' as const,
  wallpaper: 'mountain-lake' as const,
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

settingsRouter.get('/settings', (_req, res) => {
  const stored = getSetting<Record<string, unknown>>('app', {})
  res.json({ settings: { ...SETTINGS_DEFAULTS, ...stored }, defaults: SETTINGS_DEFAULTS })
})

settingsRouter.patch('/settings', (req, res) => {
  const patch = (req.body ?? {}) as Record<string, unknown>
  if (typeof patch !== 'object' || Array.isArray(patch)) {
    throw new HttpError(400, 'bad_request', 'Settings must be an object.')
  }
  const next = patchSettings(patch)
  res.json({ settings: { ...SETTINGS_DEFAULTS, ...next } })
})

settingsRouter.get('/providers', (_req, res) => {
  const providers = listProviders()
  res.json({
    providers,
    configured: providers.filter((provider) => provider.configured).map((provider) => provider.id),
    anyConfigured: providers.some((provider) => provider.configured),
  })
})

settingsRouter.patch('/providers/:id/options', (req, res) => {
  const adapter = getProvider(req.params.id)
  if (!adapter.setOptions) {
    throw new HttpError(400, 'not_configurable', `${adapter.label} has no editable options.`)
  }
  const body = (req.body ?? {}) as { baseUrl?: string; model?: string }
  const patch: Record<string, unknown> = {}
  if (body.baseUrl !== undefined) {
    const baseUrl = body.baseUrl.trim()
    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
      throw new HttpError(400, 'bad_url', 'The base URL must start with http:// or https://')
    }
    patch.baseUrl = baseUrl
  }
  if (body.model !== undefined) patch.model = body.model.trim()
  adapter.setOptions(patch)
  res.json({ provider: listProviders().find((provider) => provider.id === adapter.id) })
})

settingsRouter.get('/system', (_req, res) => {
  const counts = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM conversations) AS conversations,
        (SELECT COUNT(*) FROM messages) AS messages,
        (SELECT COUNT(*) FROM images) AS images,
        (SELECT COUNT(*) FROM agents) AS agents,
        (SELECT COUNT(*) FROM files) AS files`,
    )
    .get() as Record<string, number>

  res.json({
    app: { name: 'Cloud AI', version: APP_VERSION, dataDir: DATA_DIR },
    runtime: {
      node: process.version,
      platform: process.platform,
      previewMode: process.env.BASE44_PREVIEW_MODE === '1',
    },
    counts,
    providers: ADAPTERS.map((adapter) => ({
      id: adapter.id,
      label: adapter.label,
      configured: adapter.isConfigured(),
      envKeys: adapter.envKeys,
    })),
    agentTools: AGENT_TOOLS,
    unitCosts: COSTS,
    units: syncPeriod(),
  })
})

settingsRouter.get('/plans', (_req, res) => {
  res.json({
    plans: PLANS,
    unitCosts: COSTS,
    state: syncPeriod(),
    billingConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  })
})

settingsRouter.get('/usage', (_req, res) => {
  res.json({ state: syncPeriod(), history: usageHistory() })
})

settingsRouter.get('/activity', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 40) || 40, 100)
  res.json({ items: listActivity(limit), agentTools: AGENT_TOOLS })
})

/** Full local data export (no credentials are stored server-side). */
settingsRouter.get('/data/export', (_req, res) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'Cloud AI',
    version: APP_VERSION,
    settings: getSetting<Record<string, unknown>>('app', {}),
    units: syncPeriod(),
    usage: usageHistory(500),
    agents: db.prepare('SELECT * FROM agents').all(),
    conversations: db.prepare('SELECT * FROM conversations').all(),
    messages: db.prepare('SELECT * FROM messages').all(),
    images: db.prepare('SELECT * FROM images').all(),
    note: 'Image binaries stay in the Cloud AI data folder (see the About section of Settings).',
  }
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="cloud-ai-export-${Date.now()}.json"`)
  res.send(JSON.stringify(payload, null, 2))
})

/** Clears local conversations, images, uploads and usage history. */
settingsRouter.post('/data/reset', (req, res) => {
  const body = (req.body ?? {}) as { confirm?: string; scope?: 'history' | 'everything' }
  if (body.confirm !== 'DELETE') {
    throw new HttpError(400, 'confirmation_required', 'Send { "confirm": "DELETE" } to clear local data.')
  }
  db.exec('DELETE FROM messages; DELETE FROM conversations; DELETE FROM images; DELETE FROM files; DELETE FROM activity; DELETE FROM usage;')
  res.json({ ok: true, scope: body.scope ?? 'history' })
})
