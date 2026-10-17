/**
 * Image generation studio routes.
 *
 * Everything runs through a configured provider - when no image-capable
 * provider is set up the API refuses with a setup message rather than
 * producing a placeholder image.
 */
import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { IMAGES_DIR, db, newId, nowIso, recordActivity } from '../db.js'
import { ADAPTERS, getProvider } from '../providers/index.js'
import { SseStream } from '../sse.js'
import { HttpError, type ModelInfo } from '../types.js'
import { assertAffordable, chargeUnits } from '../units.js'

export const imagesRouter = Router()

interface AspectOption {
  id: string
  label: string
  width: number
  height: number
  sizes: Record<string, string>
}

export const ASPECTS: AspectOption[] = [
  {
    id: '1:1',
    label: 'Square',
    width: 1024,
    height: 1024,
    sizes: { openai: '1024x1024', google: '1:1' },
  },
  {
    id: '16:9',
    label: 'Landscape',
    width: 1536,
    height: 1024,
    sizes: { openai: '1536x1024', google: '16:9' },
  },
  {
    id: '9:16',
    label: 'Portrait',
    width: 1024,
    height: 1536,
    sizes: { openai: '1024x1536', google: '9:16' },
  },
  {
    id: '4:3',
    label: 'Classic',
    width: 1344,
    height: 1024,
    sizes: { openai: '1536x1024', google: '4:3' },
  },
  {
    id: '3:4',
    label: 'Tall',
    width: 1024,
    height: 1344,
    sizes: { openai: '1024x1536', google: '3:4' },
  },
]

function sizeForProvider(aspect: AspectOption, providerId: string, model: ModelInfo): string {
  const mapped = aspect.sizes[providerId] ?? aspect.sizes.openai ?? '1024x1024'
  if (model.id.startsWith('dall-e-3')) {
    if (mapped === '1536x1024') return '1792x1024'
    if (mapped === '1024x1536') return '1024x1792'
    return '1024x1024'
  }
  return mapped
}

imagesRouter.get('/images/options', (_req, res) => {
  const providers = ADAPTERS.map((adapter) => ({
    id: adapter.id,
    label: adapter.label,
    configured: adapter.isConfigured(),
    supportsImages: adapter.supportsImages,
    configIssue: adapter.configIssue?.() ?? null,
    models: adapter.models().filter((model) => model.capabilities.includes('image')),
  }))
  res.json({
    aspects: ASPECTS.map((aspect) => ({ id: aspect.id, label: aspect.label, width: aspect.width, height: aspect.height })),
    providers,
  })
})

imagesRouter.get('/images', (_req, res) => {
  const rows = db.prepare('SELECT * FROM images ORDER BY created_at DESC').all() as Array<
    Record<string, unknown> & { id: string }
  >
  res.json({
    images: rows.map((row) => ({ ...row, url: `/api/images/${row.id}/file` })),
  })
})

imagesRouter.get('/images/:id/file', (req, res) => {
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id) as
    | { file: string; mime: string; prompt: string }
    | undefined
  if (!row) throw new HttpError(404, 'not_found', 'Image not found.')
  const filePath = path.join(IMAGES_DIR, row.file)
  if (!fs.existsSync(filePath)) {
    throw new HttpError(410, 'file_missing', 'The image file is no longer on disk.')
  }
  res.type(row.mime)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  fs.createReadStream(filePath).pipe(res)
})

imagesRouter.delete('/images/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id) as
    | { file: string }
    | undefined
  if (!row) throw new HttpError(404, 'not_found', 'Image not found.')
  db.prepare('DELETE FROM images WHERE id = ?').run(req.params.id)
  try {
    fs.unlinkSync(path.join(IMAGES_DIR, row.file))
  } catch {
    // already gone
  }
  res.json({ ok: true })
})

imagesRouter.post('/images/generate', async (req, res) => {
  const body = (req.body ?? {}) as {
    provider?: string
    model?: string
    prompt?: string
    aspect?: string
  }
  const stream = new SseStream(res)
  const controller = new AbortController()
  let aborted = false
  stream.guard('images', () => {
    aborted = true
    controller.abort()
  })

  try {
    const prompt = (body.prompt ?? '').trim()
    if (!prompt) throw new HttpError(400, 'empty_prompt', 'Describe the image you want to create.')

    const adapter = getProvider(body.provider ?? '')
    if (!adapter.supportsImages || !adapter.generateImage) {
      throw new HttpError(
        400,
        'no_image_support',
        `${adapter.label} does not generate images.`,
        'Choose an image model from OpenAI (GPT Image, DALL·E 3) or Google (Imagen 4), or configure that provider in Settings.',
      )
    }
    if (!adapter.isConfigured()) {
      throw new HttpError(
        503,
        'provider_not_configured',
        `${adapter.label} is not configured.`,
        adapter.configIssue?.() ?? adapter.setupHint,
      )
    }
    const model = adapter.models().find((candidate) => candidate.id === body.model)
    if (!model) {
      throw new HttpError(400, 'unknown_model', `"${body.model}" cannot generate images.`)
    }
    const aspect = ASPECTS.find((candidate) => candidate.id === body.aspect) ?? ASPECTS[0]
    const size = sizeForProvider(aspect, adapter.id, model)

    assertAffordable('image')

    stream.send('progress', { note: `Preparing ${model.label}`, step: 1, total: 3 })
    const result = await adapter.generateImage({
      model: model.id,
      prompt,
      size,
      aspectRatio: aspect.sizes[adapter.id] ?? aspect.id,
      signal: controller.signal,
      onProgress: (note) => stream.send('progress', { note, step: 2, total: 3 }),
    })

    stream.send('progress', { note: 'Saving image', step: 3, total: 3 })
    const id = newId()
    const extension = result.mime.includes('jpeg') ? 'jpg' : result.mime.includes('webp') ? 'webp' : 'png'
    const file = `${id}.${extension}`
    fs.writeFileSync(path.join(IMAGES_DIR, file), result.data)

    const ts = nowIso()
    db.prepare(
      'INSERT INTO images (id, prompt, revised_prompt, model, provider, size, aspect, file, mime, units, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      prompt,
      result.revisedPrompt ?? null,
      model.id,
      adapter.id,
      size,
      aspect.id,
      file,
      result.mime,
      5,
      ts,
    )
    const remaining = chargeUnits('image', prompt.slice(0, 80), model.id, id)
    recordActivity('image', prompt.slice(0, 80), `${adapter.label} · ${size}`, id)

    stream.send('done', {
      image: {
        id,
        prompt,
        revised_prompt: result.revisedPrompt ?? null,
        model: model.id,
        provider: adapter.id,
        size,
        aspect: aspect.id,
        created_at: ts,
        url: `/api/images/${id}/file`,
      },
      units: 5,
      remaining,
    })
    stream.end()
  } catch (error) {
    if (aborted) {
      stream.end()
      return
    }
    stream.fail(error)
  }
})
