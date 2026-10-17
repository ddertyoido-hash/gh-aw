/**
 * Persistent storage for Cloud AI.
 *
 * SQLite via better-sqlite3. The database file (and generated images) live in
 * the Cloud AI data directory, which is a writable volume in the sandbox and
 * `~/.cloud-ai` when the desktop shell runs locally, so conversations,
 * settings, agents and history survive restarts.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export const DATA_DIR =
  process.env.CLOUD_AI_DATA_DIR && process.env.CLOUD_AI_DATA_DIR.trim() !== ''
    ? process.env.CLOUD_AI_DATA_DIR
    : path.join(os.homedir() || '.', '.cloud-ai')

export const IMAGES_DIR = path.join(DATA_DIR, 'images')
export const FILES_DIR = path.join(DATA_DIR, 'files')

export function ensureDataDirs(): void {
  for (const dir of [DATA_DIR, IMAGES_DIR, FILES_DIR]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

ensureDataDirs()

export const db = new Database(path.join(DATA_DIR, 'cloud-ai.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    agent_id TEXT,
    model TEXT,
    kind TEXT NOT NULL DEFAULT 'chat',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    units INTEGER NOT NULL DEFAULT 0,
    attachments TEXT NOT NULL DEFAULT '[]',
    error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS messages_conversation ON messages (conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    revised_prompt TEXT,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    size TEXT NOT NULL,
    aspect TEXT NOT NULL,
    file TEXT NOT NULL,
    mime TEXT NOT NULL,
    units INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    model TEXT,
    tools TEXT NOT NULL DEFAULT '[]',
    builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS usage (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    kind TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    model TEXT,
    units INTEGER NOT NULL,
    ref_id TEXT
  );
  CREATE INDEX IF NOT EXISTS usage_ts ON usage (ts);

  CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref_id TEXT,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT ''
  );
`)

export const nowIso = () => new Date().toISOString()
export const newId = () => randomUUID()

/* ------------------------------- settings ------------------------------- */

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  if (!row) return fallback
  try {
    return JSON.parse(row.value) as T
  } catch {
    return fallback
  }
}

export function setSetting(key: string, value: unknown): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value), nowIso())
}

/** Shallow merge of a settings patch; returns the full settings object. */
export function patchSettings(patch: Record<string, unknown>): Record<string, unknown> {
  const next = { ...getSetting<Record<string, unknown>>('app', {}) }
  for (const [key, value] of Object.entries(patch)) {
    next[key] = value
  }
  setSetting('app', next)
  return next
}

/* ------------------------------- activity ------------------------------- */

export function recordActivity(kind: string, title: string, subtitle: string, refId?: string): void {
  db.prepare('INSERT INTO activity (id, ts, kind, ref_id, title, subtitle) VALUES (?, ?, ?, ?, ?, ?)').run(
    newId(),
    nowIso(),
    kind,
    refId ?? null,
    title,
    subtitle,
  )
  // keep the feed bounded
  db.prepare(
    `DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY ts DESC LIMIT 200)`,
  ).run()
}

export interface ActivityRow {
  id: string
  ts: string
  kind: string
  ref_id: string | null
  title: string
  subtitle: string
}

export function listActivity(limit = 40): ActivityRow[] {
  return db
    .prepare('SELECT * FROM activity ORDER BY ts DESC LIMIT ?')
    .all(limit) as ActivityRow[]
}

export function touchConversation(id: string): void {
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(nowIso(), id)
}
