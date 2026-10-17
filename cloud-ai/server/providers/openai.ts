/**
 * OpenAI (and any OpenAI-compatible endpoint: Ollama, LM Studio, vLLM,
 * together.ai, OpenRouter ...). The OpenAI-compatible adapter is also reused
 * by the "Local / self-hosted" provider, which is how Cloud AI talks to a
 * model running on your own machine without any cloud credentials.
 */
import { getSetting, setSetting } from '../db.js'
import {
  HttpError,
  type ChatMessage,
  type ChatRequest,
  type ChatResult,
  type ImageGenerateRequest,
  type ImageGenerateResult,
  type ModelInfo,
  type ProviderAdapter,
  type StreamCallbacks,
} from '../types.js'
import { networkError, providerError, readSse } from './http.js'

export const OPENAI_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    provider: 'openai',
    capabilities: ['text', 'stream', 'vision'],
    description: 'Strong general model with excellent instruction following.',
    tier: 'powerful',
  },
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    provider: 'openai',
    capabilities: ['text', 'stream', 'vision'],
    description: 'Fast, inexpensive everyday assistant.',
    tier: 'fast',
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    capabilities: ['text', 'stream', 'vision'],
    description: 'Multimodal flagship for text and images.',
    tier: 'powerful',
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openai',
    capabilities: ['text', 'stream', 'vision'],
    description: 'Balanced speed and quality.',
    tier: 'balanced',
  },
  {
    id: 'o4-mini',
    label: 'o4-mini (reasoning)',
    provider: 'openai',
    capabilities: ['text', 'stream'],
    description: 'Reasoning model for maths, code and planning.',
    tier: 'powerful',
  },
  {
    id: 'gpt-image-1',
    label: 'GPT Image',
    provider: 'openai',
    capabilities: ['image'],
    description: 'Highest quality image generation and editing.',
    tier: 'image',
  },
  {
    id: 'dall-e-3',
    label: 'DALL·E 3',
    provider: 'openai',
    capabilities: ['image'],
    description: 'Fast, expressive image generation.',
    tier: 'image',
  },
]

interface CompatibleConfig {
  id: string
  label: string
  envKeys: string[]
  defaultBaseUrl: string
  docsUrl: string
  setupHint: string
  models: ModelInfo[]
  /** Allow a user-editable base URL (self-hosted / proxy endpoints). */
  userConfigurableBaseUrl?: boolean
  /** Require an explicitly configured base URL before the provider counts as ready. */
  requireBaseUrl?: boolean
  imageModels?: string[]
}

function optionsKey(id: string) {
  return `provider_options_${id}`
}

function readOptions<T extends Record<string, unknown>>(id: string, fallback: T): T {
  return { ...fallback, ...getSetting<Record<string, unknown>>(optionsKey(id), {}) } as T
}

function writeOptions(id: string, patch: Record<string, unknown>) {
  const next = { ...getSetting<Record<string, unknown>>(optionsKey(id), {}), ...patch }
  setSetting(optionsKey(id), next)
}

function apiKey(cfg: CompatibleConfig): string {
  for (const key of cfg.envKeys) {
    const value = process.env[key]
    if (value && value.trim() !== '') return value.trim()
  }
  return ''
}

function baseUrl(cfg: CompatibleConfig): string {
  const opts = readOptions<{ baseUrl?: string }>(cfg.id, {})
  const fromOptions = opts.baseUrl?.trim()
  return (fromOptions || cfg.defaultBaseUrl).replace(/\/$/, '')
}

export function createOpenAICompatibleAdapter(cfg: CompatibleConfig): ProviderAdapter {
  const label = cfg.label

  const isConfigured = () => {
    if (cfg.requireBaseUrl && !readOptions<{ baseUrl?: string }>(cfg.id, {}).baseUrl) return false
    if (cfg.envKeys.length === 0) return Boolean(readOptions<{ baseUrl?: string }>(cfg.id, {}).baseUrl)
    return apiKey(cfg) !== ''
  }

  return {
    id: cfg.id,
    label,
    envKeys: cfg.envKeys,
    docsUrl: cfg.docsUrl,
    setupHint: cfg.setupHint,
    isConfigured,
    configIssue: () =>
      isConfigured()
        ? null
        : cfg.requireBaseUrl
          ? `${label} needs a base URL in Settings before it can be used.`
          : `Set ${cfg.envKeys.join(' or ')} to enable ${label}.`,
    options: () => readOptions(cfg.id, { baseUrl: cfg.userConfigurableBaseUrl ? cfg.defaultBaseUrl : '' }),
    setOptions: (patch) => writeOptions(cfg.id, patch),
    models: () => {
      const opts = readOptions<{ model?: string }>(cfg.id, {})
      const text = opts.model?.trim()
      if (text) {
        return [
          {
            id: text,
            label: text,
            provider: cfg.id,
            capabilities: ['text', 'stream'] as ModelInfo['capabilities'],
            description: `Model provided by the ${label} endpoint.`,
            tier: 'balanced' as const,
          },
        ]
      }
      return cfg.models
    },
    supportsImages: Boolean(cfg.imageModels?.length),

    async streamChat(req: ChatRequest, cb: StreamCallbacks): Promise<ChatResult> {
      const key = apiKey(cfg)
      if (!isConfigured()) {
        throw new HttpError(503, 'provider_not_configured', `${label} is not configured.`, cfg.setupHint)
      }
      const url = `${baseUrl(cfg)}/chat/completions`
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (key) headers.Authorization = `Bearer ${key}`

      const body = {
        model: req.model,
        stream: true,
        stream_options: { include_usage: true },
        messages: toOpenAIMessages(req.messages),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
      }

      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: req.signal,
        })
      } catch (error) {
        if (isAbort(error)) throw abortError()
        throw networkError(label, baseUrl(cfg), error)
      }

      if (!response.ok) throw await providerError(label, response)

      let text = ''
      let usage: ChatResult['usage']
      await readSse(response, (event) => {
        if (event.data === '[DONE]') return
        const chunk = safeJson(event.data)
        if (!chunk) return
        const choice = chunk.choices?.[0]
        const delta = choice?.delta?.content
        if (typeof delta === 'string' && delta.length > 0) {
          text += delta
          cb.onDelta(delta)
        }
        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          }
        }
      })

      if (text.trim() === '') {
        throw new HttpError(
          502,
          'empty_response',
          `${label} returned an empty response.`,
          'Try again, or pick a different model in the composer.',
        )
      }
      return { text, usage }
    },

    async generateImage(req: ImageGenerateRequest): Promise<ImageGenerateResult> {
      const key = apiKey(cfg)
      if (!isConfigured()) {
        throw new HttpError(503, 'provider_not_configured', `${label} is not configured.`, cfg.setupHint)
      }
      req.onProgress?.('Sending prompt to ' + label)
      const url = `${baseUrl(cfg)}/images/generations`
      const body: Record<string, unknown> = {
        model: req.model,
        prompt: req.prompt,
        n: 1,
        size: req.size,
      }
      if (!req.model.startsWith('gpt-image')) body.response_format = 'b64_json'

      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
          body: JSON.stringify(body),
          signal: req.signal,
        })
      } catch (error) {
        if (isAbort(error)) throw abortError()
        throw networkError(label, baseUrl(cfg), error)
      }
      if (!response.ok) throw await providerError(label, response)

      req.onProgress?.('Receiving image')
      const payload = (await response.json()) as {
        data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>
      }
      const first = payload.data?.[0]
      if (!first) {
        throw new HttpError(502, 'empty_response', `${label} did not return an image.`, 'Try a different prompt or model.')
      }

      if (first.b64_json) {
        return {
          data: Buffer.from(first.b64_json, 'base64'),
          mime: 'image/png',
          revisedPrompt: first.revised_prompt,
        }
      }
      if (first.url) {
        const imageResponse = await fetch(first.url, { signal: req.signal })
        if (!imageResponse.ok) {
          throw new HttpError(502, 'download_failed', 'The generated image could not be downloaded.')
        }
        const buffer = Buffer.from(await imageResponse.arrayBuffer())
        return {
          data: buffer,
          mime: imageResponse.headers.get('content-type') ?? 'image/png',
          revisedPrompt: first.revised_prompt,
        }
      }
      throw new HttpError(502, 'empty_response', `${label} did not return image data.`)
    },
  }
}

function toOpenAIMessages(messages: ChatMessage[]) {
  return messages.map((message) => {
    const parts = message.content
    const hasImage = parts.some((part) => part.type === 'image')
    if (!hasImage) {
      return { role: message.role, content: parts.map(textOf).join('\n\n') }
    }
    return {
      role: message.role,
      content: parts.map((part) =>
        part.type === 'image'
          ? { type: 'image_url', image_url: { url: `data:${part.mime};base64,${part.data}` } }
          : { type: 'text', text: textOf(part) },
      ),
    }
  })
}

function textOf(part: ChatMessage['content'][number]): string {
  if (part.type === 'text') return part.text
  if (part.type === 'document') return `[attached document: ${part.name ?? 'document'}]`
  return `[attached image: ${part.name ?? 'image'}]`
}

function safeJson(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))
}

export function abortError(): HttpError {
  return new HttpError(499, 'cancelled', 'Generation stopped.')
}

export const openaiProvider = createOpenAICompatibleAdapter({
  id: 'openai',
  label: 'OpenAI',
  envKeys: ['OPENAI_API_KEY'],
  defaultBaseUrl: 'https://api.openai.com/v1',
  docsUrl: 'https://platform.openai.com/api-keys',
  setupHint:
    'Create an API key at platform.openai.com/api-keys and store it as OPENAI_API_KEY in the Cloud AI environment (.env for desktop builds, or the Secrets panel for the hosted app).',
  models: OPENAI_MODELS,
  userConfigurableBaseUrl: true,
  imageModels: ['gpt-image-1', 'dall-e-3'],
})

/** Self-hosted OpenAI-compatible endpoint (Ollama, LM Studio, vLLM ...). */
export const localProvider = createOpenAICompatibleAdapter({
  id: 'local',
  label: 'Local / self-hosted',
  envKeys: [],
  defaultBaseUrl: '',
  docsUrl: 'https://platform.openai.com/docs/api-reference/chat',
  setupHint:
    'Point Cloud AI at an OpenAI-compatible server (for example http://127.0.0.1:11434/v1 for Ollama) and name the model to use.',
  models: [],
  userConfigurableBaseUrl: true,
  requireBaseUrl: true,
})
