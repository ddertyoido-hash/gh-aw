/**
 * Application store: settings, providers, plans/units, agents, activity, files
 * and toasts. One place loads everything the shell needs on startup.
 */
import { create } from 'zustand'
import {
  api,
  ApiFailure,
  type ActivityItem,
  type Agent,
  type ChatAttachment,
  type Plan,
  type PlanState,
  type PublicProvider,
  type SystemInfo,
} from '../lib/api'
import { DEFAULT_SETTINGS, type AppSettings } from '../lib/defaults'

export interface Toast {
  id: string
  title: string
  description?: string
  tone: 'info' | 'success' | 'error'
}

export interface AgentToolInfo {
  id: string
  label: string
  description: string
  consequential: boolean
}

interface AppState {
  ready: boolean
  bootError: string | null
  settings: AppSettings
  system: SystemInfo | null
  providers: PublicProvider[]
  units: PlanState | null
  plans: Plan[]
  unitCosts: Record<string, number>
  billingConfigured: boolean
  activity: ActivityItem[]
  agents: Agent[]
  agentTools: AgentToolInfo[]
  files: ChatAttachment[]
  toasts: Toast[]

  bootstrap: () => Promise<void>
  refreshProviders: () => Promise<void>
  refreshUnits: () => Promise<void>
  refreshPlans: () => Promise<void>
  refreshActivity: () => Promise<void>
  refreshAgents: () => Promise<void>
  refreshFiles: () => Promise<void>
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>
  setUnits: (state: PlanState) => void
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  addFile: (file: ChatAttachment) => void
  removeFile: (id: string) => void
}

export const useAppStore = create<AppState>()((set, get) => ({
  ready: false,
  bootError: null,
  settings: DEFAULT_SETTINGS,
  system: null,
  providers: [],
  units: null,
  plans: [],
  unitCosts: { chat: 1, summarize: 2, research: 3, image: 5, voice: 1 },
  billingConfigured: false,
  activity: [],
  agents: [],
  agentTools: [],
  files: [],
  toasts: [],

  async bootstrap() {
    try {
      const [settings, system, providers, plans, agents, files, activity] = await Promise.all([
        api.settings(),
        api.system(),
        api.providers(),
        api.plans(),
        api.agents(),
        api.files(),
        api.activity(),
      ])
      set({
        settings: { ...DEFAULT_SETTINGS, ...(settings.settings as Partial<AppSettings>) },
        system,
        providers: providers.providers,
        plans: plans.plans,
        unitCosts: plans.unitCosts,
        billingConfigured: plans.billingConfigured,
        units: plans.state,
        agents: agents.agents,
        agentTools: agents.tools,
        files: files.files,
        activity: activity.items,
        ready: true,
        bootError: null,
      })
    } catch (error) {
      set({
        ready: true,
        bootError:
          error instanceof ApiFailure
            ? `${error.message}${error.hint ? ` ${error.hint}` : ''}`
            : 'Cloud AI could not load its saved data.',
      })
    }
  },

  async refreshProviders() {
    const providers = await api.providers()
    set({ providers: providers.providers })
  },

  async refreshUnits() {
    try {
      const { state } = await api.usage()
      set({ units: state })
    } catch {
      // usage refresh is best-effort
    }
  },

  async refreshPlans() {
    const plans = await api.plans()
    set({ plans: plans.plans, unitCosts: plans.unitCosts, units: plans.state, billingConfigured: plans.billingConfigured })
  },

  async refreshActivity() {
    const activity = await api.activity()
    set({ activity: activity.items })
  },

  async refreshAgents() {
    const agents = await api.agents()
    set({ agents: agents.agents, agentTools: agents.tools })
  },

  async refreshFiles() {
    const files = await api.files()
    set({ files: files.files })
  },

  async saveSettings(patch) {
    const previous = get().settings
    const next = { ...previous, ...patch }
    set({ settings: next })
    try {
      const result = await api.patchSettings(patch as Record<string, unknown>)
      set({ settings: { ...DEFAULT_SETTINGS, ...(result.settings as Partial<AppSettings>) } })
    } catch (error) {
      set({ settings: previous })
      get().pushToast({
        tone: 'error',
        title: 'Settings were not saved',
        description: error instanceof ApiFailure ? error.message : undefined,
      })
    }
  },

  setUnits(units) {
    set({ units })
  },

  pushToast(toast) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set({ toasts: [...get().toasts, { id, ...toast }] })
    const ttl = toast.tone === 'error' ? 8000 : 4500
    setTimeout(() => get().dismissToast(id), ttl)
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) })
  },

  addFile(file) {
    const existing = get().files.filter((candidate) => candidate.id !== file.id)
    set({ files: [file, ...existing] })
  },

  removeFile(id) {
    set({ files: get().files.filter((file) => file.id !== id) })
  },
}))

/** Models the user can actually use right now (providers that are configured). */
export function availableModels(providers: PublicProvider[]) {
  return providers
    .filter((provider) => provider.configured)
    .flatMap((provider) => provider.models.filter((model) => model.capabilities.includes('text')))
}

export function providerSetupNeeded(providers: PublicProvider[]): boolean {
  return providers.length > 0 && !providers.some((provider) => provider.configured)
}
