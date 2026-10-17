/**
 * Shared HTTP/SSE plumbing for provider adapters.
 */
import { HttpError } from '../types.js'

export interface SseEvent {
  event?: string
  data: string
}

/**
 * Reads an SSE response body and invokes `onEvent` for every complete event.
 * Works with the OpenAI, Anthropic and Google streaming dialects - each
 * adapter interprets the parsed JSON itself.
 */
export async function readSse(
  response: Response,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  const body = response.body
  if (!body) throw new HttpError(502, 'empty_stream', 'The provider returned no stream body')

  const decoder = new TextDecoder()
  let buffer = ''

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await body.getReader().read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const parsed = parseEvent(raw)
      if (parsed) onEvent(parsed)
      boundary = buffer.indexOf('\n\n')
    }
  }

  const tail = parseEvent(buffer)
  if (tail) onEvent(tail)
}

function parseEvent(raw: string): SseEvent | null {
  const lines = raw.split('\n')
  let event: string | undefined
  const dataLines: string[] = []
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
  }
  if (dataLines.length === 0) return null
  const data = dataLines.join('\n')
  if (!data || data === '[DONE]') return data === '[DONE]' ? { event: 'done', data } : null
  return { event, data }
}

/** Turns a non-2xx provider response into an HttpError with the provider's message. */
export async function providerError(
  providerLabel: string,
  response: Response,
): Promise<HttpError> {
  let detail = ''
  try {
    const text = await response.text()
    detail = extractMessage(text)
  } catch {
    detail = ''
  }

  if (response.status === 401 || response.status === 403) {
    return new HttpError(
      401,
      'invalid_credentials',
      `${providerLabel} rejected the configured API key.`,
      detail || 'Check the key in Settings, AI providers and make sure it is active.',
    )
  }
  if (response.status === 429) {
    return new HttpError(
      429,
      'rate_limited',
      `${providerLabel} is rate limiting this key.`,
      detail || 'Wait a moment and try again, or switch to another model.',
    )
  }
  return new HttpError(
    response.status >= 500 ? 502 : response.status,
    'provider_error',
    `${providerLabel} returned an error (HTTP ${response.status}).`,
    detail || undefined,
  )
}

function extractMessage(text: string): string {
  if (!text) return ''
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string }
    return parsed.error?.message ?? parsed.message ?? ''
  } catch {
    return text.slice(0, 400)
  }
}

/** Network failures should be actionable, not opaque. */
export function networkError(providerLabel: string, baseUrl: string, error: unknown): HttpError {
  const reason = error instanceof Error ? error.message : String(error)
  return new HttpError(
    502,
    'network_error',
    `Could not reach ${providerLabel} at ${baseUrl}.`,
    `${reason}. Check the base URL and outbound network access, then retry.`,
  )
}
