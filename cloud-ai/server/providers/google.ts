/**
 * Google Gemini adapter (Generative Language API): streaming text, vision and
 * Imagen image generation. Key comes from GOOGLE_AI_API_KEY (or GEMINI_API_KEY).
 */
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
import { abortError, isAbort } from './openai.js'
import { networkError, providerError, readSse } from './http.js'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export const GOOGLE_MODELS: ModelInfo[] = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'google',
    capabilities: ['text', 'stream', 'vision'],
    description: 'Fast multimodal model, great for everyday work.',
    tier: 'fast',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'google',
    capabilities: ['text', 'stream', 'vision'],
    description: 'Long-context reasoning for research and documents.',
    tier: 'powerful',
  },
  {
    id: 'imagen-4.0-generate-001',
    label: 'Imagen 4',
    provider: 'google',
    capabilities: ['image'],
    description: 'Photoreal image generation with aspect ratio control.',
    tier: 'image',
  },
]

function apiKey(): string {
  return (process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY ?? '').trim()
}

export const googleProvider: ProviderAdapter = {
  id: 'google',
  label: 'Google Gemini',
  envKeys: ['GOOGLE_AI_API_KEY', 'GEMINI_API_KEY'],
  docsUrl: 'https://aistudio.google.com/app/apikey',
  setupHint:
    'Create an API key in Google AI Studio and store it as GOOGLE_AI_API_KEY (GEMINI_API_KEY also works).',
  isConfigured: () => apiKey() !== '',
  configIssue: () => (apiKey() !== '' ? null : 'Set GOOGLE_AI_API_KEY to enable Gemini and Imagen.'),
  models: () => GOOGLE_MODELS,
  supportsImages: true,

  async streamChat(req: ChatRequest, cb: StreamCallbacks): Promise<ChatResult> {
    if (!apiKey()) {
      throw new HttpError(
        503,
        'provider_not_configured',
        'Google Gemini is not configured.',
        'Set GOOGLE_AI_API_KEY to enable Gemini models.',
      )
    }

    const systemText = req.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content.map(textOf).join('\n\n'))
      .join('\n\n')

    const body: Record<string, unknown> = {
      contents: req.messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: message.content.map(toGooglePart),
        })),
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      ...(req.temperature !== undefined
        ? { generationConfig: { temperature: req.temperature } }
        : {}),
    }

    const url = `${BASE_URL}/models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey())}`
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: req.signal,
      })
    } catch (error) {
      if (isAbort(error)) throw abortError()
      throw networkError('Google Gemini', BASE_URL, error)
    }
    if (!response.ok) throw await providerError('Google Gemini', response)

    let text = ''
    let usage: ChatResult['usage']
    await readSse(response, (event) => {
      if (event.data === '[DONE]') return
      const payload = safeJson(event.data)
      if (!payload) return
      const parts = payload.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        if (typeof part.text === 'string' && part.text.length > 0) {
          text += part.text
          cb.onDelta(part.text)
        }
      }
      if (payload.usageMetadata) {
        usage = {
          inputTokens: payload.usageMetadata.promptTokenCount,
          outputTokens: payload.usageMetadata.candidatesTokenCount,
          totalTokens: payload.usageMetadata.totalTokenCount,
        }
      }
    })

    if (text.trim() === '') {
      throw new HttpError(
        502,
        'empty_response',
        'Gemini returned an empty response.',
        'This can happen when a safety filter blocks the prompt, or when the model is unavailable. Try rephrasing.',
      )
    }
    return { text, usage }
  },

  async generateImage(req: ImageGenerateRequest): Promise<ImageGenerateResult> {
    if (!apiKey()) {
      throw new HttpError(
        503,
        'provider_not_configured',
        'Google Gemini is not configured.',
        'Set GOOGLE_AI_API_KEY to enable Imagen.',
      )
    }
    req.onProgress?.('Sending prompt to Imagen')
    const url = `${BASE_URL}/models/${encodeURIComponent(req.model)}:predict?key=${encodeURIComponent(apiKey())}`
    const body = {
      instances: [{ prompt: req.prompt }],
      parameters: { sampleCount: 1, aspectRatio: req.aspectRatio },
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: req.signal,
      })
    } catch (error) {
      if (isAbort(error)) throw abortError()
      throw networkError('Google Gemini', BASE_URL, error)
    }
    if (!response.ok) throw await providerError('Google Gemini', response)

    const payload = (await response.json()) as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
    }
    const prediction = payload.predictions?.[0]
    if (!prediction?.bytesBase64Encoded) {
      throw new HttpError(
        502,
        'empty_response',
        'Imagen did not return image data.',
        'The prompt may have been filtered. Try a different description.',
      )
    }
    return {
      data: Buffer.from(prediction.bytesBase64Encoded, 'base64'),
      mime: prediction.mimeType ?? 'image/png',
    }
  },
}

function toGooglePart(part: ChatMessage['content'][number]) {
  if (part.type === 'image') {
    return { inlineData: { mimeType: part.mime, data: part.data } }
  }
  if (part.type === 'document') {
    if (part.mime === 'application/pdf') {
      return { inlineData: { mimeType: part.mime, data: part.data } }
    }
    return { text: `[attached document: ${part.name ?? 'document'}]` }
  }
  return { text: part.text }
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
