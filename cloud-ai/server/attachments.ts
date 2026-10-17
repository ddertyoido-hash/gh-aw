/**
 * Attachment handling: uploaded files become provider-agnostic content parts.
 *
 * - images are sent as base64 to vision-capable models
 * - text-like files are inlined (capped) so every provider can read them
 * - PDFs are inlined as documents for providers that support them
 * - anything else produces a clear, actionable error instead of a silent no-op
 */
import fs from 'node:fs'
import path from 'node:path'
import { db } from './db.js'
import { HttpError, type ContentPart, type ModelInfo } from './types.js'

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.html',
  '.htm',
  '.css',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.cs',
  '.php',
  '.sh',
  '.sql',
  '.log',
  '.ini',
  '.toml',
  '.env',
])

const MAX_TEXT_CHARS = 40_000

interface FileRow {
  id: string
  name: string
  mime: string
  size: number
  path: string
  created_at: string
}

export function fileRow(id: string): FileRow | undefined {
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id) as FileRow | undefined
}

export function listFiles(): FileRow[] {
  return db.prepare('SELECT * FROM files ORDER BY created_at DESC').all() as FileRow[]
}

/**
 * Converts uploaded file ids into content parts for the selected model.
 * Throws when the model cannot handle an attachment, naming the reason.
 */
export function buildAttachmentParts(fileIds: string[], model: ModelInfo | undefined): ContentPart[] {
  const parts: ContentPart[] = []
  for (const id of fileIds) {
    const row = fileRow(id)
    if (!row) {
      throw new HttpError(400, 'attachment_missing', 'An attached file is no longer available.')
    }

    const isImage = row.mime.startsWith('image/')
    if (isImage) {
      if (model && !model.capabilities.includes('vision')) {
        throw new HttpError(
          400,
          'vision_not_supported',
          `"${model.label}" cannot read images.`,
          'Switch to a vision model (for example GPT-4.1, Claude Sonnet 4.5 or Gemini 2.5 Flash) and send again.',
        )
      }
      const data = fs.readFileSync(row.path).toString('base64')
      parts.push({ type: 'image', mime: row.mime, data, name: row.name })
      continue
    }

    if (row.mime === 'application/pdf') {
      if (model && ['anthropic', 'google'].includes(model.provider)) {
        const data = fs.readFileSync(row.path).toString('base64')
        parts.push({ type: 'document', mime: row.mime, data, name: row.name })
        continue
      }
      throw new HttpError(
        400,
        'pdf_not_supported',
        `"${model?.label ?? 'This model'}" cannot read PDF files.`,
        'Choose a Claude or Gemini model for PDF analysis, or paste the text into the composer.',
      )
    }

    if (isTextLike(row)) {
      const raw = fs.readFileSync(row.path, 'utf8')
      const text = raw.length > MAX_TEXT_CHARS ? `${raw.slice(0, MAX_TEXT_CHARS)}\n\n[... truncated]` : raw
      parts.push({
        type: 'text',
        name: row.name,
        text: `Attached file "${row.name}" (${formatBytes(row.size)}):\n\n${text}`,
      })
      continue
    }

    throw new HttpError(
      400,
      'unsupported_attachment',
      `"${row.name}" (${row.mime || 'unknown type'}) cannot be analyzed yet.`,
      'Attach images, PDFs (Claude/Gemini) or text-based files.',
    )
  }
  return parts
}

function isTextLike(row: FileRow): boolean {
  if (row.mime.startsWith('text/')) return true
  if (['application/json', 'application/xml', 'application/x-yaml', 'application/javascript'].includes(row.mime)) {
    return true
  }
  return TEXT_EXTENSIONS.has(path.extname(row.name).toLowerCase())
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
