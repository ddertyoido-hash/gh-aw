/**
 * Minimal, honest page reader used by the `web` agent tool.
 *
 * It fetches a public URL, strips tags and hands the model the visible text.
 * Nothing else is retrieved, and the caller has already confirmed the action.
 */
import { HttpError } from './types.js'

const MAX_CHARS = 12_000
const TIMEOUT_MS = 12_000

export interface PageText {
  title: string
  text: string
}

export async function fetchPageText(url: string, signal?: AbortSignal): Promise<PageText> {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new HttpError(400, 'bad_url', 'Only http and https pages can be read.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'CloudAI/0.1 (+page reader)' },
    })
    if (!response.ok) {
      throw new HttpError(502, 'fetch_failed', `The page responded with HTTP ${response.status}.`)
    }
    const contentType = response.headers.get('content-type') ?? ''
    const raw = await response.text()
    if (contentType.includes('text/html') || raw.trimStart().startsWith('<')) {
      return { title: extractTitle(raw), text: stripHtml(raw).slice(0, MAX_CHARS) }
    }
    return { title: parsed.hostname, text: raw.slice(0, MAX_CHARS) }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim().slice(0, 160) : ''
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    mdash: '-',
    ndash: '-',
    hellip: '...',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
  }
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
}

function safeCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}
