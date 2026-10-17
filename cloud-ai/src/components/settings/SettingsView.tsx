/**
 * Settings: general preferences, appearance and wallpapers, AI providers, voice,
 * privacy, local data, plan and units, shortcuts and about.
 *
 * Everything is persisted server-side (SQLite), so preferences, conversations
 * and the unit balance survive a restart. Provider credentials are never
 * entered here in the browser build - they live in the environment; the desktop
 * build stores them in the operating system's credential store.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  Check,
  Database,
  Download,
  ExternalLink,
  Gauge,
  Info,
  Keyboard,
  KeyRound,
  LayoutTemplate,
  Palette,
  RefreshCw,
  Rocket,
  Shield,
  Sparkles,
  Trash2,
  Volume2,
  Zap,
} from 'lucide-react'
import { api, ApiFailure, type Plan } from '../../lib/api'
import { ACCENTS, SHORTCUTS, WALLPAPERS, type Accent, type Theme, type WallpaperId } from '../../lib/defaults'
import { desktop, isDesktop } from '../../lib/desktop'
import { navigate, useRoute } from '../../lib/router'
import { supportsBrowserSpeech, supportsSpeechSynthesis } from '../../lib/desktop'
import { useSpeaker } from '../../lib/useVoice'
import { useAppStore } from '../../store/app'
import { cn, formatRelative, shortcutLabel } from '../../lib/utils'
import { Button, Field, IconButton, Input, Segmented, Select, Slider, Spinner, Toggle } from '../common/Controls'
import { Modal } from '../common/Modal'
import { CloudLogo } from '../brand/Logo'

type Tab =
  | 'general'
  | 'appearance'
  | 'wallpaper'
  | 'providers'
  | 'voice'
  | 'privacy'
  | 'data'
  | 'plan'
  | 'shortcuts'
  | 'about'

const TABS: Array<{ id: Tab; label: string; icon: typeof Info }> = [
  { id: 'general', label: 'General', icon: Gauge },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'wallpaper', label: 'Wallpaper', icon: LayoutTemplate },
  { id: 'providers', label: 'AI providers', icon: KeyRound },
  { id: 'voice', label: 'Voice', icon: Volume2 },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'data', label: 'Local data', icon: Database },
  { id: 'plan', label: 'Plan & units', icon: Zap },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'about', label: 'About', icon: Info },
]

export function SettingsView() {
  const route = useRoute()
  const pushToast = useAppStore((state) => state.pushToast)
  const refreshPlans = useAppStore((state) => state.refreshPlans)
  const [tab, setTab] = useState<Tab>((route.query.get('tab') as Tab) ?? 'general')
  const [confirmingReset, setConfirmingReset] = useState(false)

  useEffect(() => {
    const requested = route.query.get('tab') as Tab | null
    if (requested && requested !== tab) setTab(requested)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.query])

  // Returning from a Stripe Checkout: verify the session server-side.
  useEffect(() => {
    const billing = route.query.get('billing')
    const sessionId = route.query.get('session_id')
    if (billing === 'success' && sessionId) {
      api
        .confirmCheckout(sessionId)
        .then(async () => {
          await refreshPlans()
          pushToast({ tone: 'success', title: 'Welcome to Pro', description: 'Your AI units have been topped up.' })
        })
        .catch((error) =>
          pushToast({
            tone: 'error',
            title: 'Could not confirm the payment',
            description: error instanceof ApiFailure ? error.message : undefined,
          }),
        )
      navigate('/settings?tab=plan', { replace: true })
    } else if (billing === 'cancelled') {
      pushToast({ tone: 'info', title: 'Checkout cancelled' })
      navigate('/settings?tab=plan', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-5 px-5 pb-28 pt-6 sm:px-8">
      <nav className="hidden w-[210px] shrink-0 flex-col gap-1 lg:flex">
        {TABS.map((entry) => {
          const Icon = entry.icon
          const active = entry.id === tab
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-[13px] transition focus-ring',
                active ? 'glass text-ink shadow-sm' : 'text-ink-soft hover:bg-white/50 dark:hover:bg-white/10',
              )}
            >
              <Icon size={15} className={active ? 'text-[color:var(--aurora-blue)]' : 'text-ink-muted'} />
              {entry.label}
            </button>
          )
        })}
      </nav>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="lg:hidden">
          <Select value={tab} onChange={(event) => setTab(event.target.value as Tab)}>
            {TABS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </Select>
        </div>

        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {tab === 'general' && <GeneralSection />}
          {tab === 'appearance' && <AppearanceSection />}
          {tab === 'wallpaper' && <WallpaperSection />}
          {tab === 'providers' && <ProvidersSection />}
          {tab === 'voice' && <VoiceSection />}
          {tab === 'privacy' && <PrivacySection onResetRequested={() => setConfirmingReset(true)} />}
          {tab === 'data' && <DataSection onResetRequested={() => setConfirmingReset(true)} />}
          {tab === 'plan' && <PlanSection />}
          {tab === 'shortcuts' && <ShortcutsSection />}
          {tab === 'about' && <AboutSection />}
        </motion.div>
      </div>

      <Modal
        open={confirmingReset}
        onClose={() => setConfirmingReset(false)}
        title="Clear local data?"
        description="Conversations, messages, generated images, uploads and usage history are deleted from this device. Settings and agents are kept."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={15} />}
              onClick={async () => {
                try {
                  await api.resetData('history')
                  await Promise.all([
                    useAppStore.getState().refreshActivity(),
                    useAppStore.getState().refreshFiles(),
                    useAppStore.getState().refreshUsage(),
                  ])
                  pushToast({ tone: 'success', title: 'Local data cleared' })
                } catch (error) {
                  pushToast({
                    tone: 'error',
                    title: 'Could not clear the data',
                    description: error instanceof ApiFailure ? error.message : undefined,
                  })
                } finally {
                  setConfirmingReset(false)
                }
              }}
            >
              Clear everything
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-ink-soft">This cannot be undone.</p>
      </Modal>
    </div>
  )
}

/* --------------------------------- shared --------------------------------- */

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5">
      <header className="mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">{description}</p>}
      </header>
      {children}
    </section>
  )
}

/* --------------------------------- general -------------------------------- */

function GeneralSection() {
  const settings = useAppStore((state) => state.settings)
  const saveSettings = useAppStore((state) => state.saveSettings)
  const providers = useAppStore((state) => state.providers)
  const system = useAppStore((state) => state.system)
  const desktopMode = isDesktop()

  return (
    <>
      <Panel title="Profile" description="Cloud AI keeps everything on this machine - there is no account to sign in to.">
        <Field label="Display name">
          <Input
            value={settings.profileName}
            onChange={(event) => void saveSettings({ profileName: event.target.value })}
            placeholder="Local workspace"
          />
        </Field>
      </Panel>

      <Panel title="Defaults" description="The model Cloud AI starts with in every new conversation.">
        <Field label="Default model">
          <Select
            value={settings.defaultModel}
            onChange={(event) => {
              const match = providers
                .flatMap((provider) => provider.models.map((model) => ({ provider: provider.id, model })))
                .find((entry) => entry.model.id === event.target.value)
              if (match) void saveSettings({ defaultProvider: match.provider, defaultModel: match.model.id })
            }}
          >
            {providers.filter((provider) => provider.configured).length === 0 && (
              <option value={settings.defaultModel}>{settings.defaultModel} (not connected)</option>
            )}
            {providers
              .filter((provider) => provider.configured)
              .map((provider) => (
                <optgroup key={provider.id} label={provider.label}>
                  {provider.models
                    .filter((model) => model.capabilities.includes('text'))
                    .map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                </optgroup>
              ))}
          </Select>
        </Field>
      </Panel>

      <Panel title="Application">
        <Toggle
          label="Desktop notifications"
          description="Tell me when a long generation finishes."
          checked={settings.notifications}
          onChange={(value) => void saveSettings({ notifications: value })}
        />
        <Toggle
          label="Launch at startup"
          description={
            desktopMode
              ? 'Start Cloud AI when you sign in to your computer.'
              : 'Available in the Cloud AI desktop app (Electron build).'
          }
          disabled={!desktopMode}
          checked={settings.launchAtStartup}
          onChange={(value) => {
            void saveSettings({ launchAtStartup: value })
            void desktop?.preferences.setLaunchAtStartup(value)
          }}
        />
        <Toggle
          label="Animated interface"
          description="Aurora movement, floating cards and transition animations."
          checked={settings.animations}
          onChange={(value) => void saveSettings({ animations: value })}
        />
        <Toggle
          label="Reduce motion"
          description="Keeps the interface still. The operating system setting is honoured automatically."
          checked={settings.reduceMotion}
          onChange={(value) => void saveSettings({ reduceMotion: value })}
        />
        {system && (
          <div className="mt-3 rounded-2xl bg-white/50 px-3 py-2 text-[12px] text-ink-muted dark:bg-white/5">
            {system.app.name} {system.app.version} · {system.runtime.platform} · Node {system.runtime.node}
          </div>
        )}
      </Panel>
    </>
  )
}

/* ------------------------------- appearance ------------------------------- */

function AppearanceSection() {
  const settings = useAppStore((state) => state.settings)
  const saveSettings = useAppStore((state) => state.saveSettings)

  return (
    <>
      <Panel title="Theme">
        <Segmented
          value={settings.theme}
          onChange={(value: Theme) => void saveSettings({ theme: value })}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
        />
      </Panel>

      <Panel title="Accent colour" description="Used for highlights, the send button, focus rings and the aurora logo.">
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((accent) => (
            <button
              key={accent.id}
              type="button"
              onClick={() => void saveSettings({ accent: accent.id as Accent })}
              aria-pressed={settings.accent === accent.id}
              className={cn(
                'flex items-center gap-2 rounded-2xl border px-3 py-2 transition',
                settings.accent === accent.id
                  ? 'border-white/80 bg-white/80 shadow-sm dark:border-white/25 dark:bg-white/15'
                  : 'border-white/50 bg-white/40 hover:bg-white/60 dark:border-white/10 dark:bg-white/5',
              )}
            >
              <span className="flex">
                {accent.colors.map((color) => (
                  <span
                    key={color}
                    className="-ml-1 h-5 w-5 rounded-full border border-white/70 first:ml-0"
                    style={{ background: color }}
                  />
                ))}
              </span>
              <span className="text-[12.5px] font-medium text-ink">{accent.name}</span>
              {settings.accent === accent.id && <Check size={14} className="text-[color:var(--aurora-blue)]" />}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Glass" description="Balance transparency against readability. Text stays legible at every setting.">
        <div className="space-y-5">
          <Slider
            label="Glass opacity"
            value={settings.glassOpacity}
            min={35}
            max={95}
            onChange={(value) => void saveSettings({ glassOpacity: value })}
            valueLabel={`${settings.glassOpacity}%`}
          />
          <Slider
            label="Wallpaper dimming"
            value={settings.wallpaperDim}
            min={0}
            max={70}
            onChange={(value) => void saveSettings({ wallpaperDim: value })}
            valueLabel={`${settings.wallpaperDim}%`}
          />
        </div>
      </Panel>
    </>
  )
}

/* -------------------------------- wallpaper ------------------------------- */

function WallpaperSection() {
  const settings = useAppStore((state) => state.settings)
  const saveSettings = useAppStore((state) => state.saveSettings)

  return (
    <Panel title="Nature wallpapers" description="Three illustrated scenes. Each one is drawn in vector form, so it stays sharp and works offline.">
      <div className="grid gap-3 sm:grid-cols-3">
        {WALLPAPERS.map((wallpaper) => (
          <button
            key={wallpaper.id}
            type="button"
            onClick={() => void saveSettings({ wallpaper: wallpaper.id as WallpaperId })}
            aria-pressed={settings.wallpaper === wallpaper.id}
            className={cn(
              'overflow-hidden rounded-3xl border text-left transition',
              settings.wallpaper === wallpaper.id
                ? 'border-white/80 shadow-lift dark:border-white/30'
                : 'border-white/50 hover:shadow-lift dark:border-white/10',
            )}
          >
            <span className="block h-24 w-full" style={{ background: gradientFor(wallpaper.id) }} />
            <span className="block px-3 py-2">
              <span className="block text-[13px] font-medium text-ink">{wallpaper.name}</span>
              <span className="block text-[11.5px] text-ink-muted">{wallpaper.description}</span>
            </span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function gradientFor(id: WallpaperId): string {
  if (id === 'forest') return 'linear-gradient(160deg, #0c2a33, #1f5a55 55%, #cfe0c6)'
  if (id === 'cloudscape') return 'linear-gradient(160deg, #0d3b66, #4c8fc0 50%, #fdf3e3)'
  return 'linear-gradient(160deg, #0f2b52, #3b6ea5 45%, #f0b171 80%, #f7d9a8)'
}

/* -------------------------------- providers ------------------------------- */

function ProvidersSection() {
  const providers = useAppStore((state) => state.providers)
  const refreshProviders = useAppStore((state) => state.refreshProviders)
  const pushToast = useAppStore((state) => state.pushToast)
  const system = useAppStore((state) => state.system)
  const [drafts, setDrafts] = useState<Record<string, { baseUrl: string; model: string }>>({})
  const [refreshing, setRefreshing] = useState(false)
  const desktopMode = isDesktop()

  const dirty = (id: string) => Boolean(drafts[id])

  const save = async (id: string) => {
    const draft = drafts[id]
    if (!draft) return
    try {
      await api.providerOptions(id, { baseUrl: draft.baseUrl, model: draft.model })
      await refreshProviders()
      setDrafts((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      pushToast({ tone: 'success', title: 'Provider updated' })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not save the provider',
        description: error instanceof ApiFailure ? error.message : undefined,
      })
    }
  }

  return (
    <>
      <Panel
        title="AI model providers"
        description="Cloud AI calls official provider APIs directly. Keys are read from the server environment only - never from the browser, browser storage or logs."
      >
        <div className="space-y-3">
          {providers.map((provider) => {
            const draft = drafts[provider.id] ?? {
              baseUrl: String(provider.options.baseUrl ?? ''),
              model: String(provider.options.model ?? ''),
            }
            const editable = provider.id === 'local' || provider.id === 'openai'
            return (
              <div
                key={provider.id}
                className="rounded-2xl border border-white/50 bg-white/45 p-3.5 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium text-ink">{provider.label}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          provider.configured
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
                        )}
                      >
                        {provider.configured ? 'Connected' : 'Not configured'}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] text-ink-muted">{provider.setupHint}</div>
                    {provider.envKeys.length > 0 && (
                      <code className="mt-1 inline-block rounded bg-slate-900/8 px-1.5 py-0.5 font-mono text-[11px] text-ink-soft dark:bg-white/10">
                        {provider.envKeys.join(' · ')}
                      </code>
                    )}
                    {provider.configIssue && (
                      <div className="mt-1 text-[12px] text-amber-700 dark:text-amber-200">{provider.configIssue}</div>
                    )}
                  </div>
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-[color:var(--aurora-blue)]"
                  >
                    Documentation
                    <ExternalLink size={13} />
                  </a>
                </div>

                {editable && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Input
                      value={draft.baseUrl}
                      placeholder={
                        provider.id === 'local' ? 'http://127.0.0.1:11434/v1' : 'https://api.openai.com/v1'
                      }
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [provider.id]: { ...draft, baseUrl: event.target.value } }))
                      }
                      aria-label={`${provider.label} base URL`}
                    />
                    <Input
                      value={draft.model}
                      placeholder={provider.id === 'local' ? 'llama3.2' : 'optional model override'}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [provider.id]: { ...draft, model: event.target.value } }))
                      }
                      aria-label={`${provider.label} model`}
                    />
                    <Button variant={dirty(provider.id) ? 'primary' : 'soft'} onClick={() => void save(provider.id)} disabled={!dirty(provider.id)}>
                      Save
                    </Button>
                  </div>
                )}

                {provider.id === 'local' && (
                  <p className="mt-2 text-[11.5px] leading-snug text-ink-muted">
                    Works with Ollama (<code className="font-mono">/v1</code>) and LM Studio. Nothing leaves your
                    machine when you use a local endpoint.
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="soft"
            icon={refreshing ? <Spinner size={14} /> : <RefreshCw size={14} />}
            onClick={async () => {
              setRefreshing(true)
              try {
                await refreshProviders()
                pushToast({ tone: 'success', title: 'Provider status refreshed' })
              } finally {
                setRefreshing(false)
              }
            }}
          >
            Refresh status
          </Button>
          <span className="text-[12px] text-ink-muted">
            Changed a key? Update the environment and restart the Cloud AI service.
          </span>
        </div>
      </Panel>

      {desktopMode && desktop && (
        <Panel
          title="Desktop credential store"
          description="In the desktop build, keys can be stored in your operating system's credential store instead of an environment file."
        >
          <DesktopCredentials pushToast={pushToast} />
        </Panel>
      )}

      {system && (
        <Panel title="How keys are used">
          <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-soft">
            <li>• Requests are signed on the server; the browser never sees a key.</li>
            <li>• Keys are never written to conversations, exports or logs.</li>
            <li>• Cloud AI stores no key itself: the desktop app can keep one encrypted in the OS keychain.</li>
            <li>• Model choice is per message, so you can switch providers any time.</li>
          </ul>
        </Panel>
      )}
    </>
  )
}

function DesktopCredentials({
  pushToast,
}: {
  pushToast: (toast: { tone: 'info' | 'success' | 'error'; title: string; description?: string }) => void
}) {
  const [name, setName] = useState('OPENAI_API_KEY')
  const [value, setValue] = useState('')
  const [stored, setStored] = useState<string[]>([])
  const [secure, setSecure] = useState(true)

  useEffect(() => {
    void desktop?.credentials.list().then(setStored)
  }, [])

  const save = async () => {
    if (!desktop || !name.trim() || !value.trim()) return
    const result = await desktop.credentials.set(name.trim(), value.trim())
    setSecure(result.secure)
    setValue('')
    setStored(await desktop.credentials.list())
    pushToast({
      tone: 'success',
      title: `${name.trim()} stored`,
      description: result.secure ? 'Encrypted with the OS credential store.' : 'Stored in the app data folder.',
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="OPENAI_API_KEY" aria-label="Key name" />
        <Input
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Paste the key value"
          aria-label="Key value"
        />
        <Button variant="primary" onClick={() => void save()} disabled={!name.trim() || !value.trim()}>
          Store
        </Button>
      </div>
      {stored.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stored.map((entry) => (
            <span
              key={entry}
              className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/60 px-2.5 py-1 text-[12px] dark:border-white/15 dark:bg-white/10"
            >
              {entry}
              <button
                type="button"
                className="text-rose-500"
                onClick={async () => {
                  await desktop?.credentials.remove(entry)
                  setStored((await desktop?.credentials.list()) ?? [])
                }}
              >
                remove
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-[12px] text-ink-muted">
        Values are encrypted with {secure ? 'the OS credential store' : 'a local key'} and passed to the Cloud AI
        service when it starts. They are never displayed again.
      </p>
    </div>
  )
}

/* ---------------------------------- voice --------------------------------- */

function VoiceSection() {
  const settings = useAppStore((state) => state.settings)
  const saveSettings = useAppStore((state) => state.saveSettings)
  const speaker = useSpeaker()
  const [capabilities, setCapabilities] = useState<{ serverSpeech: boolean; serverTranscription: boolean } | null>(null)

  useEffect(() => {
    api
      .voiceCapabilities()
      .then((result) => setCapabilities({ serverSpeech: result.serverSpeech, serverTranscription: result.serverTranscription }))
      .catch(() => setCapabilities(null))
  }, [])

  return (
    <>
      <Panel title="Voice preferences" description="Applied to dictation and to spoken replies.">
        <Toggle
          label="Read answers aloud automatically"
          checked={settings.voice.autoSpeak}
          onChange={(value) => void saveSettings({ voice: { ...settings.voice, autoSpeak: value } })}
        />
        <Toggle
          label="Use the server voice"
          description={
            capabilities?.serverSpeech
              ? 'Synthesised by the provider instead of the device voice.'
              : 'Requires an OpenAI key (OPENAI_API_KEY).'
          }
          disabled={!capabilities?.serverSpeech}
          checked={settings.voice.useServerTts}
          onChange={(value) => void saveSettings({ voice: { ...settings.voice, useServerTts: value } })}
        />
        {supportsSpeechSynthesis() && speaker.voices.length > 0 && (
          <div className="py-2.5">
            <Field label="Device voice">
              <Select
                value={settings.voice.voiceName}
                onChange={(event) => void saveSettings({ voice: { ...settings.voice, voiceName: event.target.value } })}
              >
                <option value="">System default</option>
                {speaker.voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <div className="space-y-5 pt-3">
          <Slider
            label="Speaking rate"
            value={settings.voice.rate}
            min={0.5}
            max={2}
            step={0.05}
            onChange={(value) => void saveSettings({ voice: { ...settings.voice, rate: value } })}
            valueLabel={`${settings.voice.rate.toFixed(2)}×`}
          />
          <Slider
            label="Pitch"
            value={settings.voice.pitch}
            min={0.5}
            max={1.6}
            step={0.05}
            onChange={(value) => void saveSettings({ voice: { ...settings.voice, pitch: value } })}
            valueLabel={settings.voice.pitch.toFixed(2)}
          />
        </div>
        {settings.voice.voiceName && (
          <Button
            className="mt-3"
            variant="soft"
            icon={<Volume2 size={15} />}
            onClick={() => void speaker.speak('This is how Cloud AI will read your answers aloud.')}
          >
            Preview voice
          </Button>
        )}
      </Panel>

      <Panel title="What is available" description="Voice features degrade gracefully - Cloud AI tells you exactly which engine is missing.">
        <ul className="space-y-1.5 text-[12.5px] text-ink-soft">
          <li>• On-device recognition: {supportsBrowserSpeech() ? 'available in this browser' : 'not available here'}</li>
          <li>• Device speech playback: {supportsSpeechSynthesis() ? `${speaker.voices.length} voices` : 'not available here'}</li>
          <li>• Server transcription: {capabilities?.serverTranscription ? 'configured' : 'not configured'}</li>
          <li>• Server speech: {capabilities?.serverSpeech ? 'configured' : 'not configured'}</li>
        </ul>
      </Panel>
    </>
  )
}

/* --------------------------------- privacy -------------------------------- */

function PrivacySection({ onResetRequested }: { onResetRequested: () => void }) {
  const settings = useAppStore((state) => state.settings)
  const saveSettings = useAppStore((state) => state.saveSettings)

  return (
    <>
      <Panel title="Privacy controls">
        <Toggle
          label="Send attachments to the model"
          description="When off, the composer refuses attachments and nothing is uploaded."
          checked={settings.privacy.sendAttachments}
          onChange={(value) => void saveSettings({ privacy: { ...settings.privacy, sendAttachments: value } })}
        />
        <Toggle
          label="Store conversations on this device"
          description="Off means answers stream but nothing is written to the database - conversations vanish when you leave the screen."
          checked={settings.storeHistory}
          onChange={(value) => void saveSettings({ storeHistory: value })}
        />
      </Panel>

      <Panel title="What leaves your machine" description="Cloud AI only contacts a provider when you send a message or generate an image.">
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-soft">
          <li>• A chat request sends your message, the recent turns of that conversation and any attachments you added.</li>
          <li>• An image request sends only the prompt and the chosen size.</li>
          <li>• Nothing else - no telemetry, no analytics, no background calls.</li>
          <li>• Local models (Ollama, LM Studio) keep everything on your machine.</li>
        </ul>
        <Button className="mt-4" variant="soft" icon={<Trash2 size={15} />} onClick={onResetRequested}>
          Clear local conversations and images
        </Button>
      </Panel>
    </>
  )
}

/* ------------------------------- local data ------------------------------- */

function DataSection({ onResetRequested }: { onResetRequested: () => void }) {
  const system = useAppStore((state) => state.system)
  const files = useAppStore((state) => state.files)
  const refreshFiles = useAppStore((state) => state.refreshFiles)
  const pushToast = useAppStore((state) => state.pushToast)

  useEffect(() => {
    void refreshFiles()
  }, [refreshFiles])

  return (
    <>
      <Panel title="Storage" description="Cloud AI keeps a SQLite database and your generated images in its data folder.">
        <div className="grid gap-2 sm:grid-cols-2">
          {system &&
            Object.entries(system.counts).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-2xl bg-white/50 px-3 py-2 text-[12.5px] dark:bg-white/5"
              >
                <span className="capitalize text-ink-muted">{key}</span>
                <span className="font-medium tabular-nums text-ink">{value}</span>
              </div>
            ))}
        </div>
        {system && (
          <div className="mt-3 break-all rounded-2xl bg-white/50 px-3 py-2 font-mono text-[11.5px] text-ink-muted dark:bg-white/5">
            {system.app.dataDir}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="soft"
            icon={<Download size={15} />}
            onClick={() => {
              window.location.href = api.exportUrl()
              pushToast({ tone: 'success', title: 'Export started' })
            }}
          >
            Export everything (JSON)
          </Button>
          <Button variant="danger" icon={<Trash2 size={15} />} onClick={onResetRequested}>
            Clear local data
          </Button>
        </div>
      </Panel>

      <Panel title="Uploaded files" description="Attachments are stored privately in the data folder and served only through this app.">
        {files.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">No uploaded files yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {files.slice(0, 20).map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/50 px-3 py-2 dark:bg-white/5">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">
                  {file.name} <span className="text-ink-muted">· {file.sizeLabel ?? ''}</span>
                </span>
                <a
                  href={`${file.url}?download=1`}
                  className="text-[12px] font-medium text-[color:var(--aurora-blue)]"
                  download
                >
                  Download
                </a>
                <IconButton
                  label={`Delete ${file.name}`}
                  size="sm"
                  className="text-rose-500"
                  onClick={async () => {
                    await api.deleteFile(file.id)
                    await refreshFiles()
                  }}
                >
                  <Trash2 size={14} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

/* ---------------------------------- plan ---------------------------------- */

function PlanSection() {
  const plans = useAppStore((state) => state.plans)
  const units = useAppStore((state) => state.units)
  const billingConfigured = useAppStore((state) => state.billingConfigured)
  const refreshPlans = useAppStore((state) => state.refreshPlans)
  const pushToast = useAppStore((state) => state.pushToast)
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>(units?.cycle ?? 'monthly')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<Array<{ id: string; ts: string; label: string; units: number; kind: string }>>([])

  useEffect(() => {
    void refreshPlans()
    api
      .usage()
      .then((result) => setHistory(result.history as typeof history))
      .catch(() => setHistory([]))
  }, [refreshPlans])

  const upgrade = async () => {
    setBusy(true)
    try {
      const { url } = await api.checkout(cycle)
      window.location.href = url
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Checkout is not available',
        description: error instanceof ApiFailure ? error.hint ?? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const switchPlan = async (plan: 'free' | 'pro') => {
    setBusy(true)
    try {
      await api.setPlan(plan, cycle)
      await Promise.all([refreshPlans(), useAppStore.getState().refreshUnits()])
      pushToast({ tone: 'success', title: `Switched to the ${plan} plan` })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not change the plan',
        description: error instanceof ApiFailure ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Panel title="Usage this period" description="Balances are calculated and enforced on the server, so the client can never grant itself units.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Remaining" value={`${units?.remaining ?? '–'}`} hint={`of ${units?.granted ?? '–'} granted`} />
          <Metric label="Used" value={`${units?.spent ?? '–'}`} hint={`${units?.period ?? ''}`} />
          <Metric label="Renews" value={units ? new Date(units.renewsAt).toLocaleDateString() : '–'} hint={units?.plan ?? 'free'} />
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-400/30 dark:bg-slate-600/50">
          <div
            className="h-full rounded-full aurora-surface"
            style={{
              width: `${units && units.granted > 0 ? Math.max(2, Math.round((units.remaining / units.granted) * 100)) : 2}%`,
            }}
          />
        </div>
      </Panel>

      <Panel title="Plans">
        <Segmented
          value={cycle}
          onChange={setCycle}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly', icon: <Sparkles size={13} /> },
          ]}
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {plans.map((plan: Plan) => {
            const active = units?.plan === plan.id
            return (
              <div
                key={plan.id}
                className={cn(
                  'rounded-3xl border p-4',
                  active
                    ? 'border-white/70 bg-white/70 shadow-lift dark:border-white/25 dark:bg-white/10'
                    : 'border-white/50 bg-white/40 dark:border-white/10 dark:bg-white/5',
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-ink">{plan.name}</h3>
                  {active && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                      current
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[22px] font-semibold tracking-tight text-ink">
                  {plan.priceMonthly === 0 ? 'Free' : `$${cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly}`}
                  {plan.priceMonthly > 0 && (
                    <span className="text-[12.5px] font-normal text-ink-muted">/{cycle === 'yearly' ? 'year' : 'month'}</span>
                  )}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-muted">{plan.tagline}</p>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[12.5px] text-ink-soft">
                      <Check size={13} className="mt-0.5 shrink-0 text-[color:var(--aurora-blue)]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  {plan.id === 'pro' && !active ? (
                    billingConfigured ? (
                      <Button variant="primary" block loading={busy} icon={<Rocket size={15} />} onClick={() => void upgrade()}>
                        Upgrade with Stripe
                      </Button>
                    ) : (
                      <Button variant="soft" block loading={busy} onClick={() => void switchPlan('pro')}>
                        Switch to Pro (payments not configured)
                      </Button>
                    )
                  ) : plan.id === 'free' && active ? (
                    <Button variant="soft" block disabled>
                      Your current plan
                    </Button>
                  ) : plan.id === 'free' ? (
                    <Button variant="ghost" block loading={busy} onClick={() => void switchPlan('free')}>
                      Downgrade to Free
                    </Button>
                  ) : (
                    <Button variant="soft" block disabled>
                      Active
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {!billingConfigured && (
          <p className="mt-3 text-[12px] leading-snug text-ink-muted">
            Stripe checkout appears once STRIPE_SECRET_KEY and the Pro price IDs are configured. Until then, plan changes
            are applied locally for development - purchases are always validated server-side before units are granted.
          </p>
        )}
      </Panel>

      <Panel title="Unit costs" description="Shown before an action runs, so there are no surprises.">
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(useAppStore.getState().unitCosts).map(([kind, cost]) => (
            <div key={kind} className="flex items-center justify-between rounded-2xl bg-white/50 px-3 py-2 text-[12.5px] dark:bg-white/5">
              <span className="capitalize text-ink-muted">{kind}</span>
              <span className="font-medium tabular-nums text-ink">{cost} units</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Usage history" description="Every charged action in this billing period.">
        {history.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">Nothing used yet this period.</p>
        ) : (
          <ul className="space-y-1.5">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/50 px-3 py-2 dark:bg-white/5">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">{entry.label || entry.kind}</span>
                <span className="shrink-0 text-[11.5px] text-ink-muted">{formatRelative(entry.ts)}</span>
                <span className="shrink-0 font-medium tabular-nums text-ink">{entry.units}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/50 bg-white/50 px-3.5 py-3 dark:border-white/10 dark:bg-white/5">
      <div className="text-[11.5px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-ink">{value}</div>
      {hint && <div className="text-[11.5px] text-ink-muted">{hint}</div>}
    </div>
  )
}

/* -------------------------------- shortcuts ------------------------------- */

function ShortcutsSection() {
  return (
    <Panel title="Keyboard shortcuts" description="Chosen to avoid conflicts with operating system shortcuts.">
      <ul className="divide-y divide-white/40 dark:divide-white/10">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.keys} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-[13px] text-ink-soft">{shortcut.action}</span>
            <kbd className="rounded-lg border border-white/50 bg-white/60 px-2 py-1 font-mono text-[11.5px] text-ink dark:border-white/15 dark:bg-white/10">
              {shortcutLabel(shortcut.keys)}
            </kbd>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ---------------------------------- about --------------------------------- */

function AboutSection() {
  const system = useAppStore((state) => state.system)
  const settings = useAppStore((state) => state.settings)

  return (
    <>
      <Panel title="About Cloud AI">
        <div className="flex items-start gap-4">
          <CloudLogo size={64} />
          <div>
            <h3 className="text-[16px] font-semibold tracking-tight text-ink">
              Cloud<span className="aurora-text"> AI</span>
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              A premium desktop AI assistant with a calm, nature-inspired interface. Chat, writing, image generation,
              research, voice and specialised agents in one window - connecting only to the AI providers you configure.
            </p>
            <p className="mt-2 text-[12px] text-ink-muted">
              Version {system?.app.version ?? '0.1.0'} · {system?.runtime.platform ?? 'web'}
              {system?.runtime.previewMode ? ' · preview mode' : ''}
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Identity">
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          The Cloud AI name, wordmark and aurora gradient app icon are original to this project. The interface takes
          inspiration from modern assistant designs, but Cloud AI is an independent application and is not affiliated
          with, endorsed by, or using the trademarks of Microsoft, Apple or any other vendor.
        </p>
      </Panel>

      <Panel title="Diagnostics">
        <div className="grid gap-2 sm:grid-cols-2">
          {system &&
            Object.entries({
              'App version': system.app.version,
              'Runtime': `Node ${system.runtime.node}`,
              'Platform': system.runtime.platform,
              'Desktop bridge': isDesktop() ? 'connected' : 'browser mode',
              'Theme': settings.theme,
              'Wallpaper': settings.wallpaper,
              'Providers configured': system.providers.filter((provider) => provider.configured).map((provider) => provider.id).join(', ') || 'none',
              'Data folder': system.app.dataDir,
            }).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-2xl bg-white/50 px-3 py-2 dark:bg-white/5">
                <span className="text-[12px] text-ink-muted">{label}</span>
                <span className="min-w-0 truncate text-[12px] font-medium text-ink">{value}</span>
              </div>
            ))}
        </div>
      </Panel>
    </>
  )
}
