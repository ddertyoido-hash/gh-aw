/**
 * Cloud AI API server.
 *
 * Serves the REST/SSE API used by the web UI and by the Electron desktop
 * shell. It is the only place provider credentials are read, so keys never
 * reach the browser.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type NextFunction, type Request, type Response } from 'express'
import { ensureBuiltinAgents } from './agents.js'
import { DATA_DIR } from './db.js'
import { agentsRouter } from './routes/agents.js'
import { billingRouter } from './routes/billing.js'
import { chatRouter } from './routes/chat.js'
import { filesRouter } from './routes/files.js'
import { imagesRouter } from './routes/images.js'
import { settingsRouter } from './routes/settings.js'
import { HttpError } from './types.js'
import { ADAPTERS } from './providers/index.js'

const PORT = Number(process.env.CLOUD_AI_API_PORT || 3001)
const HOST = process.env.CLOUD_AI_API_HOST || '0.0.0.0'
const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(here, '..', 'dist')

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '4mb' }))

app.use('/api', chatRouter)
app.use('/api', imagesRouter)
app.use('/api', agentsRouter)
app.use('/api', settingsRouter)
app.use('/api', filesRouter)
app.use('/api', billingRouter)

// Production/desktop builds serve the compiled UI from the same origin, so the
// packaged app has no CORS or proxy requirements at all.
if (fs.existsSync(distDir) && process.env.CLOUD_AI_SERVE_STATIC !== '0') {
  app.use(express.static(distDir, { index: false }))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Unknown API route.' } })
})

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, hint: error.hint } })
    return
  }
  const candidate = error as { status?: number; code?: string; message?: string; hint?: string }
  if (candidate && typeof candidate.status === 'number' && candidate.code) {
    res.status(candidate.status).json({
      error: { code: candidate.code, message: candidate.message ?? 'Request failed', hint: candidate.hint },
    })
    return
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: { code: 'bad_json', message: 'The request body was not valid JSON.' } })
    return
  }
  console.error('[cloud-ai] unhandled error', error)
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Cloud AI hit an unexpected error.',
      hint: 'Check the API logs for the full stack trace.',
    },
  })
})

ensureBuiltinAgents()

const server = app.listen(PORT, HOST, () => {
  const configured = ADAPTERS.filter((adapter) => adapter.isConfigured()).map((adapter) => adapter.id)
  console.log(`[cloud-ai] API listening on http://${HOST}:${PORT}`)
  console.log(`[cloud-ai] data directory: ${DATA_DIR}`)
  console.log(`[cloud-ai] configured providers: ${configured.length > 0 ? configured.join(', ') : 'none - the UI will show the setup screen'}`)
  if (fs.existsSync(distDir)) console.log('[cloud-ai] serving compiled UI from dist/')
})

const shutdown = (signal: string) => {
  console.log(`[cloud-ai] ${signal} received, shutting down`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
