/**
 * Anthropic Claude adapter (Messages API, streaming + vision + PDF documents).
 * Anthropic does not offer image generation, so `generateImage` is absent and
 * the Images studio points users at OpenAI or Google instead.
 */
import {
  HttpError,
  type ChatMessage,
  type ChatRequest,
  type ChatResult,
  type ModelInfo,
  type ProviderAdapter,
  type StreamCallbacks,
} from '../types.js'
import { isAbort, abortError } from './openai.js'
import { networkError, providerError, readSse } from './http.js'

const BASE_URL = 'https://api.anthropic.com/v1'
const API_VERSION = '2023-06-01'

export const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    capabilities: ['text', 'stream', 'vision'],
    description: 'Best balance of speed and depth; reads images and PDFs.',
    tier: 'powerful',
  },
  {
    id: 'claude-opus-4-1',
    label: 'Claude Opus 4.1',
    provider: 'anthropic',
    capabilities: ['text', 'stream', 'vision'],
    description: 'Deepest reasoning for complex research and long documents.',
    tier: 'powerful',
  },
  {
    id: 'claude-3-5-haiku-latest',
    label: 'Claude Haiku 3.5',
    provider: 'anthropic',
    capabilities: ['text', 'stream', 'vision'],
    description: 'Fastest responses for quick questions and drafts.',
    tier: 'fast',
  },
]

function apiKey(): string {
  return (process.env.ANTHROPIC_API_KEY ?? '').trim()
}

export const anthropicProvider: ProviderAdapter = {
  id: 'anthropic',
  label: 'Anthropic',
  envKeys: ['ANTHROPIC_API_KEY'],
  docsUrl: 'https://console.anthropic.com/settings/keys',
  setupHint:
    'Create an API key in the Anthropic Console and store it as ANTHROPIC_API_KEY. Cloud AI never writes keys to the browser or to logs.',
  isConfigured: () => apiKey() !== '',
  configIssue: () => (apiKey() !== '' ? null : 'Set ANTHROPIC_API_KEY to enable Claude models.'),
  models: () => ANTHROPIC_MODELS,
  supportsImages: false,

  async streamChat(req: ChatRequest, cb: StreamCallbacks): Promise<ChatResult> {
    if (!apiKey()) {
      throw new HttpError(
        503,
        'provider_not_configured',
        'Anthropic is not configured.',
        'Set ANTHROPIC_API_KEY to enable Claude models.',
      )
    }

    const system = req.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content.map(textOf).join('\n\n'))
      .join('\n\n')

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? 4096,
      stream: true,
      messages: req.messages
        .filter((message) => message.role !== 'system')
        .map(toAnthropicMessage),
      ...(system ? { system } : {}),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    }

    let response: Response
    try {
      response = await fetch(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey(),
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify(body),
        signal: req.signal,
      })
    } catch (error) {
      if (isAbort(error)) throw abortError()
      throw networkError('Anthropic', BASE_URL, error)
    }
    if (!response.ok) throw await providerError('Anthropic', response)

    let text = ''
    let usage: ChatResult['usage']
    let stopReason = ''
    await readSse(response, (event) => {
      const payload = safeJson(event.data)
      if (!payload) return
      if (payload.type === 'content_block_delta' && payload.delta?.type === 'text_delta') {
        const delta: string = payload.delta.text ?? ''
        if (delta) {
          text += delta
          cb.onDelta(delta)
        }
      }
      if (payload.type === 'message_start' && payload.message?.usage) {
        usage = { inputTokens: payload.message.usage.input_tokens }
      }
      if (payload.type === 'message_delta') {
        if (payload.delta?.stop_reason) stopReason = payload.delta.stop_reason
        if (payload.usage?.output_tokens !== undefined) {
          usage = { ...(usage ?? {}), outputTokens: payload.usage.output_tokens }
        }
      }
      if (payload.type === 'error') {
        throw new Error(payload.error?.message ?? 'Anthropic stream error')
      }
    })

    if (text.trim() === '') {
      throw new HttpError(
        502,
        'empty_response',
        stopReason === 'max_tokens'
          ? 'Claude stopped before writing any text (token limit reached).'
          : 'Claude returned an empty response.',
        'Try again with a shorter prompt or a different model.',
      )
    }
    return { text, usage }
  },
}

function toAnthropicMessage(message: ChatMessage) {
  const content = message.content.map((part) => {
    if (part.type === 'image') {
      return {
        type: 'image',
        source: { type: 'base64', media_type: part.mime, data: part.data },
      }
    }
    if (part.type === 'document') {
      if (part.mime === 'application/pdf') {
        return {
          type: 'document',
          source: { type: 'base64', media_type: part.mime, data: part.data },
          ...(part.name ? { title: part.name } : {}),
        }
      }
      return { type: 'text', text: `[attached document: ${part.name ?? 'document'}]` }
    }
    return { type: 'text', text: part.text }
  })
  return { role: message.role === 'assistant' ? 'assistant' : 'user', content }
}

function textOf(part: ChatMessage['content'][number]): string {
  if (part.type === 'text') return part.text
  return `[attached ${part.type}: ${part.name ?? 'file'}]`
}

function safeJson(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
