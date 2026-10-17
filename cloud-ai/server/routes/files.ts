/**
 * File uploads (attachments) and voice services.
 *
 * Uploads are stored in the Cloud AI data folder and are served back only
 * through this API - there is no public bucket. Voice uses the browser's own
 * speech engine by default; when an OpenAI key is present the server offers
 * real transcription and speech synthesis as well.
 */
import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { FILES_DIR, db, newId, nowIso } from '../db.js'
import { formatBytes } from '../attachments.js'
import { HttpError } from '../types.js'
import { assertAffordable, chargeUnits } from '../units.js'

export const filesRouter = Router()

const MAX_FILE_BYTES = 25 * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 8 },
})

export const ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
]

filesRouter.get('/files', (_req, res) => {
  const rows = db
    .prepare('SELECT id, name, mime, size, created_at FROM files ORDER BY created_at DESC')
    .all() as Array<{ id: string; name: string; mime: string; size: number; created_at: string }>
  res.json({
    files: rows.map((row) => ({
      ...row,
      sizeLabel: formatBytes(row.size),
      url: `/api/files/${row.id}`,
    })),
  })
})

filesRouter.post('/files', upload.array('files', 8), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (files.length === 0) throw new HttpError(400, 'no_files', 'No files were uploaded.')

  const saved = files.map((file) => {
    const id = newId()
    const extension = path.extname(file.originalname).slice(0, 12)
    const stored = `${id}${extension}`
    fs.writeFileSync(path.join(FILES_DIR, stored), file.buffer)
    db.prepare('INSERT INTO files (id, name, mime, size, path, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      file.originalname,
      file.mimetype,
      file.size,
      stored,
      nowIso(),
    )
    return {
      id,
      name: file.originalname,
      mime: file.mimetype,
      size: file.size,
      sizeLabel: formatBytes(file.size),
      url: `/api/files/${id}`,
    }
  })
  res.status(201).json({ files: saved })
})

filesRouter.get('/files/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; mime: string; size: number; path: string }
    | undefined
  if (!row) throw new HttpError(404, 'not_found', 'File not found.')
  const filePath = path.join(FILES_DIR, row.path)
  if (!fs.existsSync(filePath)) throw new HttpError(410, 'file_missing', 'That file is no longer on disk.')
  res.type(row.mime)
  if (req.query.download === '1') {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.name)}"`)
  }
  fs.createReadStream(filePath).pipe(res)
})

filesRouter.delete('/files/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id) as { path: string } | undefined
  if (!row) throw new HttpError(404, 'not_found', 'File not found.')
  db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id)
  try {
    fs.unlinkSync(path.join(FILES_DIR, row.path))
  } catch {
    // already gone
  }
  res.json({ ok: true })
})

/* -------------------------------- voice -------------------------------- */

function openAiKey(): string {
  return (process.env.OPENAI_API_KEY ?? '').trim()
}

filesRouter.get('/voice/capabilities', (_req, res) => {
  res.json({
    serverTranscription: openAiKey() !== '',
    serverSpeech: openAiKey() !== '',
    transcribeModel: process.env.CLOUD_AI_TRANSCRIBE_MODEL ?? 'whisper-1',
    speechModel: process.env.CLOUD_AI_SPEECH_MODEL ?? 'tts-1',
    note: 'Browser speech recognition and speech synthesis work without any key; server transcription is used when an OpenAI key is configured.',
  })
})

filesRouter.post('/voice/transcribe', upload.single('audio'), async (req, res) => {
  const file = req.file
  if (!file) throw new HttpError(400, 'no_audio', 'No audio was uploaded.')
  if (!openAiKey()) {
    throw new HttpError(
      503,
      'provider_not_configured',
      'Server transcription needs an OpenAI API key.',
      'Set OPENAI_API_KEY, or use the browser microphone button which transcribes locally in Chromium.',
    )
  }

  assertAffordable('voice')
  const form = new FormData()
  const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'audio/webm' })
  form.append('file', blob, file.originalname || 'audio.webm')
  form.append('model', process.env.CLOUD_AI_TRANSCRIBE_MODEL ?? 'whisper-1')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey()}` },
    body: form,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new HttpError(
      response.status === 401 ? 401 : 502,
      'transcription_failed',
      'The transcription service rejected the audio.',
      detail.slice(0, 300) || undefined,
    )
  }
  const payload = (await response.json()) as { text?: string }
  const remaining = chargeUnits('voice', 'Transcription', process.env.CLOUD_AI_TRANSCRIBE_MODEL ?? 'whisper-1', null)
  res.json({ text: payload.text ?? '', remaining })
})

filesRouter.post('/voice/speech', async (req, res) => {
  const body = (req.body ?? {}) as { text?: string; voice?: string }
  const text = (body.text ?? '').trim()
  if (!text) throw new HttpError(400, 'empty_text', 'There is nothing to read aloud.')
  if (!openAiKey()) {
    throw new HttpError(
      503,
      'provider_not_configured',
      'Server speech needs an OpenAI API key.',
      'Cloud AI falls back to your device voice; turn off "Use server voice" in Settings, Voice.',
    )
  }

  assertAffordable('voice')
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey()}` },
    body: JSON.stringify({
      model: process.env.CLOUD_AI_SPEECH_MODEL ?? 'tts-1',
      voice: body.voice ?? 'alloy',
      input: text.slice(0, 4000),
      response_format: 'mp3',
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new HttpError(502, 'speech_failed', 'The speech service could not generate audio.', detail.slice(0, 300) || undefined)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const remaining = chargeUnits('voice', 'Speech playback', process.env.CLOUD_AI_SPEECH_MODEL ?? 'tts-1', null)
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('X-Cloud-Units-Remaining', String(remaining))
  res.send(buffer)
})
