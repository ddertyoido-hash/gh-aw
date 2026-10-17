/**
 * Small helpers for server-sent event streams.
 *
 * Chat replies, image generation progress and voice transcription all stream
 * through these; every payload is a single `data:` JSON line so the client
 * parser stays trivial.
 */
import type { Response } from 'express'
import { HttpError } from './types.js'

export class SseStream {
  private res: Response
  private closed = false

  constructor(res: Response) {
    this.res = res
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
  }

  send(event: string, data: unknown): void {
    if (this.closed) return
    try {
      this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    } catch {
      this.closed = true
    }
  }

  end(): void {
    if (this.closed) return
    this.closed = true
    this.res.end()
  }

  get isClosed(): boolean {
    return this.closed
  }

  fail(error: unknown): void {
    if (error instanceof HttpError) {
      this.send('error', { code: error.code, message: error.message, hint: error.hint })
    } else if (error instanceof Error) {
      this.send('error', { code: 'provider_error', message: error.message })
    } else {
      this.send('error', { code: 'unknown_error', message: 'Unexpected server error' })
    }
    this.end()
  }

  /** Streams a provider error inside an already-open stream, then closes. */
  guard(context: string, onAbort: () => void): void {
    this.res.on('close', () => {
      this.closed = true
      onAbort()
    })
    this.res.on('error', () => {
      this.closed = true
      onAbort()
    })
    void context
  }
}
