/**
 * Shared server types for Cloud AI.
 *
 * Everything a provider adapter needs to implement lives here, so a new
 * provider can be added by writing one file in `server/providers/` and
 * registering it - no changes to the routes or the UI.
 */

export type Capability = 'text' | 'stream' | 'vision' | 'image' | 'tools'

export interface ModelInfo {
  id: string
  label: string
  provider: string
  capabilities: Capability[]
  description: string
  /** Relative cost hint shown in the model selector. */
  tier: 'fast' | 'balanced' | 'powerful' | 'image'
}

export interface ImagePart {
  type: 'image'
  mime: string
  /** base64 payload without the data-url prefix */
  data: string
  name?: string
}

export interface TextPart {
  type: 'text'
  text: string
  name?: string
}

/** Inline document (PDF) - currently used by the Anthropic and Gemini adapters. */
export interface DocumentPart {
  type: 'document'
  mime: string
  data: string
  name?: string
}

export type ContentPart = TextPart | ImagePart | DocumentPart

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: ContentPart[]
}

export interface TokenUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface StreamCallbacks {
  onDelta: (text: string) => void
}

export interface ChatResult {
  text: string
  usage?: TokenUsage
}

export interface ImageGenerateRequest {
  model: string
  prompt: string
  size: string
  aspectRatio: string
  signal?: AbortSignal
  onProgress?: (note: string) => void
}

export interface ImageGenerateResult {
  data: Buffer
  mime: string
  revisedPrompt?: string
}

export interface ProviderAdapter {
  id: string
  label: string
  /** Environment variable that holds the credential, if the provider needs one. */
  envKeys: string[]
  docsUrl: string
  setupHint: string
  /** Credentials present + provider usable right now. */
  isConfigured: () => boolean
  /** Human readable reason when the provider cannot be used. */
  configIssue?: () => string | null
  /** Runtime (non-secret) options such as a self-hosted base URL. */
  options?: () => Record<string, unknown>
  setOptions?: (patch: Record<string, unknown>) => void
  models: () => ModelInfo[]
  supportsImages: boolean
  streamChat: (req: ChatRequest, cb: StreamCallbacks) => Promise<ChatResult>
  generateImage?: (req: ImageGenerateRequest) => Promise<ImageGenerateResult>
}

export class HttpError extends Error {
  status: number
  code: string
  hint?: string

  constructor(status: number, code: string, message: string, hint?: string) {
    super(message)
    this.status = status
    this.code = code
    this.hint = hint
  }
}

export const httpError = (status: number, code: string, message: string, hint?: string) =>
  new HttpError(status, code, message, hint)
