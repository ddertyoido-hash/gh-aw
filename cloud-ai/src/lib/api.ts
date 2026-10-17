/**
 * Cloud AI API client.
 *
 * Every network call in the UI goes through this module. Chat and image
 * generation are server-sent event streams that are parsed here, so
 * components only deal with callbacks.
 */

export interface ApiErrorShape {
  code: string
  message: string
  hint?: string
}

export class ApiFailure extends Error {
  code: string
  hint?: string
  status: number

  constructor(status: number, error: ApiErrorShape) {
    super(error.message)
    this.name = 'ApiFailure'
    this.status = status
    this.code = error.code
    this.hint = error.hint
  }

  get isSetupIssue(): boolean {
    return this.code === 'provider_not_configured' || this.code === 'invalid_credentials'
  }

  get needsUpgrade(): boolean {
    return this.code === 'insufficient_units'
  }
}

const BASE = ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    })
  } catch (error) {
    throw new ApiFailure(0, {
      code: 'network_error',
      message: 'Cloud AI could not reach its local service.',
      hint: error instanceof Error ? error.message : undefined,
    })
  }

  if (!response.ok) {
    throw new ApiFailure(response.status, await readError(response))
  }
  if (response.status === 204) return undefined as T
  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) return (await response.text()) as unknown as T
  return (await response.json()) as T
}

async function readError(response: Response): Promise<ApiErrorShape> {
  try {
    const body = (await response.json()) as { error?: ApiErrorShape }
    if (body.error) return body.error
  } catch {
    // fall through
  }
  return {
    code: 'request_failed',
    message: `The request failed with HTTP ${response.status}.`,
  }
}

/* ------------------------------ SSE parsing ------------------------------ */

export interface SseHandlers {
  onEvent: (event: string, data: any) => void
}

async function readStream(path: string, body: unknown, handlers: SseHandlers, signal: AbortSignal): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (signal.aborted) return
    throw new ApiFailure(0, {
      code: 'network_error',
      message: 'Cloud AI could not reach its local service.',
      hint: error instanceof Error ? error.message : undefined,
    })
  }

  // Errors are reported as plain JSON when the stream never opened.
  if (!response.ok) throw new ApiFailure(response.status, await readError(response))

  const reader = response.body?.getReader()
  if (!reader) {
    throw new ApiFailure(502, { code: 'empty_stream', message: 'The service returned an empty stream.' })
  }

  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        dispatch(chunk, handlers)
        boundary = buffer.indexOf('\n\n')
      }
    }
    if (buffer.trim()) dispatch(buffer, handlers)
  } catch (error) {
    if (signal.aborted) return
    throw new ApiFailure(0, {
      code: 'stream_interrupted',
      message: 'The connection to the model was interrupted.',
      hint: error instanceof Error ? error.message : undefined,
    })
  }
}

function dispatch(chunk: string, handlers: SseHandlers): void {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
  }
  if (dataLines.length === 0) return
  const raw = dataLines.join('\n')
  let parsed: unknown = raw
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = raw
  }
  handlers.onEvent(event, parsed)
}

/* --------------------------------- types --------------------------------- */

export interface ProviderModel {
  id: string
  label: string
  provider: string
  capabilities: string[]
  description: string
  tier: 'fast' | 'balanced' | 'powerful' | 'image'
}

export interface PublicProvider {
  id: string
  label: string
  configured: boolean
  configIssue: string | null
  docsUrl: string
  setupHint: string
  envKeys: string[]
  supportsImages: boolean
  options: Record<string, unknown>
  models: ProviderModel[]
}

export interface ChatAttachment {
  id: string
  name: string
  mime: string
  size: number
  sizeLabel?: string
  url: string
}

export interface Agent {
  id: string
  name: string
  icon: string
  color: string
  description: string
  instructions: string
  model: string | null
  tools: string[]
  builtin: boolean
  conversationCount: number
  recentConversations: Array<{ id: string; title: string; updated_at: string }>
}

export interface Conversation {
  id: string
  title: string
  agent_id: string | null
  model: string | null
  kind: string
  created_at: string
  updated_at: string
  pinned: number
  messageCount?: number
  preview?: string
}

export interface ChatMessageRow {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model: string | null
  units: number
  attachments: string[]
  error: string | null
  created_at: string
}

export interface GeneratedImage {
  id: string
  prompt: string
  revised_prompt: string | null
  model: string
  provider: string
  size: string
  aspect: string
  units: number
  created_at: string
  url: string
}

export interface PlanState {
  plan: 'free' | 'pro'
  cycle: 'monthly' | 'yearly'
  period: string
  granted: number
  remaining: number
  spent: number
  renewsAt: string
}

export interface Plan {
  id: 'free' | 'pro'
  name: string
  priceMonthly: number
  priceYearly: number
  units: number
  tagline: string
  features: string[]
}

export interface ActivityItem {
  id: string
  ts: string
  kind: 'chat' | 'image' | 'document' | 'research' | 'voice'
  ref_id: string | null
  title: string
  subtitle: string
}

export interface SystemInfo {
  app: { name: string; version: string; dataDir: string }
  runtime: { node: string; platform: string; previewMode: boolean }
  counts: Record<string, number>
  providers: Array<{ id: string; label: string; configured: boolean; envKeys: string[] }>
  agentTools: Array<{ id: string; label: string; description: string; consequential: boolean }>
  unitCosts: Record<string, number>
  units: PlanState
}

/* ------------------------------- endpoints ------------------------------- */

export const api = {
  system: () => request<SystemInfo>('/api/system'),
  settings: () => request<{ settings: Record<string, unknown>; defaults: Record<string, unknown> }>('/api/settings'),
  patchSettings: (patch: Record<string, unknown>) =>
    request<{ settings: Record<string, unknown> }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  providers: () =>
    request<{ providers: PublicProvider[]; configured: string[]; anyConfigured: boolean }>('/api/providers'),
  providerOptions: (id: string, patch: { baseUrl?: string; model?: string }) =>
    request<{ provider: PublicProvider }>(`/api/providers/${id}/options`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  plans: () =>
    request<{ plans: Plan[]; unitCosts: Record<string, number>; state: PlanState; billingConfigured: boolean }>(
      '/api/plans',
    ),
  usage: () => request<{ state: PlanState; history: Array<Record<string, unknown>> }>('/api/usage'),
  activity: (limit = 40) => request<{ items: ActivityItem[] }>(`/api/activity?limit=${limit}`),
  billingStatus: () =>
    request<{ configured: boolean; missing: string[]; provider: string; state: PlanState; plans: Plan[] }>(
      '/api/billing/status',
    ),
  checkout: (cycle: 'monthly' | 'yearly') =>
    request<{ url: string; sessionId: string }>('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ cycle, plan: 'pro' }),
    }),
  confirmCheckout: (sessionId: string) =>
    request<{ ok: boolean; state: PlanState }>(`/api/billing/confirm?session_id=${encodeURIComponent(sessionId)}`),
  setPlan: (plan: 'free' | 'pro', cycle: 'monthly' | 'yearly') =>
    request<{ state: PlanState }>('/api/billing/plan', {
      method: 'POST',
      body: JSON.stringify({ plan, cycle }),
    }),

  conversations: (kind?: string) =>
    request<{ conversations: Conversation[] }>(`/api/conversations${kind ? `?kind=${kind}` : ''}`),
  conversation: (id: string) =>
    request<{ conversation: Conversation; messages: ChatMessageRow[] }>(`/api/conversations/${id}`),
  createConversation: (body: { title?: string; agentId?: string | null; kind?: string; model?: string }) =>
    request<{ conversation: Conversation }>('/api/conversations', { method: 'POST', body: JSON.stringify(body) }),
  patchConversation: (id: string, patch: { title?: string; pinned?: boolean; agentId?: string | null }) =>
    request<{ conversation: Conversation }>(`/api/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteConversation: (id: string) => request<{ ok: true }>(`/api/conversations/${id}`, { method: 'DELETE' }),
  truncate: (id: string, afterMessageId: string | null) =>
    request<{ ok: true }>(`/api/conversations/${id}/truncate`, {
      method: 'POST',
      body: JSON.stringify({ afterMessageId }),
    }),
  editMessage: (id: string, content: string) =>
    request<{ message: ChatMessageRow; conversationId: string }>(`/api/messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  agents: () =>
    request<{ agents: Agent[]; tools: Array<{ id: string; label: string; description: string; consequential: boolean }> }>(
      '/api/agents',
    ),
  createAgent: (body: Record<string, unknown>) =>
    request<{ agent: Agent }>('/api/agents', { method: 'POST', body: JSON.stringify(body) }),
  updateAgent: (id: string, body: Record<string, unknown>) =>
    request<{ agent: Agent }>(`/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAgent: (id: string) => request<{ ok: true }>(`/api/agents/${id}`, { method: 'DELETE' }),

  images: () => request<{ images: GeneratedImage[] }>('/api/images'),
  imageOptions: () =>
    request<{
      aspects: Array<{ id: string; label: string; width: number; height: number }>
      providers: Array<{
        id: string
        label: string
        configured: boolean
        supportsImages: boolean
        configIssue: string | null
        models: ProviderModel[]
      }>
    }>('/api/images/options'),
  deleteImage: (id: string) => request<{ ok: true }>(`/api/images/${id}`, { method: 'DELETE' }),

  files: () => request<{ files: ChatAttachment[] }>('/api/files'),
  uploadFiles: async (files: File[]) => {
    const form = new FormData()
    for (const file of files) form.append('files', file)
    return request<{ files: ChatAttachment[] }>('/api/files', { method: 'POST', body: form })
  },
  deleteFile: (id: string) => request<{ ok: true }>(`/api/files/${id}`, { method: 'DELETE' }),

  voiceCapabilities: () =>
    request<{
      serverTranscription: boolean
      serverSpeech: boolean
      transcribeModel: string
      speechModel: string
      note: string
    }>('/api/voice/capabilities'),
  transcribe: async (blob: Blob) => {
    const form = new FormData()
    form.append('audio', blob, 'recording.webm')
    return request<{ text: string; remaining: number }>('/api/voice/transcribe', { method: 'POST', body: form })
  },
  speech: async (text: string, voice: string) => {
    const response = await fetch('/api/voice/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    })
    if (!response.ok) throw new ApiFailure(response.status, await readError(response))
    return response.blob()
  },

  exportUrl: () => '/api/data/export',
  resetData: (scope: 'history' | 'everything' = 'history') =>
    request<{ ok: true; scope: string }>('/api/data/reset', {
      method: 'POST',
      body: JSON.stringify({ confirm: 'DELETE', scope }),
    }),

  /** Streams a chat response. Resolves when the stream ends. */
  streamChat: (
    body: Record<string, unknown>,
    handlers: SseHandlers,
    signal: AbortSignal,
  ) => readStream('/api/chat', body, handlers, signal),

  /** Streams image generation progress and the final image. */
  streamImage: (
    body: Record<string, unknown>,
    handlers: SseHandlers,
    signal: AbortSignal,
  ) => readStream('/api/images/generate', body, handlers, signal),
}

export type { SseHandlers as StreamHandlers }
