/**
 * Chat and conversation routes.
 *
 * `POST /api/chat` streams a real model response as server-sent events while
 * persisting both turns, so a conversation always survives a restart.
 */
import { Router, type Request, type Response } from 'express'
import { buildSystemPrompt, getAgent, type ChatMode } from '../agents.js'
import { buildAttachmentParts } from '../attachments.js'
import { db, getSetting, newId, nowIso, recordActivity, touchConversation } from '../db.js'
import { getProvider, providerForModel } from '../providers/index.js'
import { SseStream } from '../sse.js'
import { HttpError, type ChatMessage } from '../types.js'
import { assertAffordable, chargeUnits, syncPeriod } from '../units.js'
import { fetchPageText } from '../web.js'

export const chatRouter = Router()

interface MessageRow {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model: string | null
  units: number
  attachments: string
  error: string | null
  created_at: string
}

interface ConversationRow {
  id: string
  title: string
  agent_id: string | null
  model: string | null
  kind: string
  created_at: string
  updated_at: string
  pinned: number
}

const HISTORY_WINDOW = 20

function parseAttachments(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function titleFrom(text: string, fallback: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return fallback
  return clean.length > 68 ? `${clean.slice(0, 65)}...` : clean
}

/* ---------------------------- conversations ---------------------------- */

chatRouter.get('/conversations', (req, res) => {
  const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined
  const rows = (
    kind
      ? db
          .prepare('SELECT * FROM conversations WHERE kind = ? ORDER BY pinned DESC, updated_at DESC')
          .all(kind)
      : db.prepare('SELECT * FROM conversations ORDER BY pinned DESC, updated_at DESC').all()
  ) as ConversationRow[]

  const preview = db.prepare(
    'SELECT content, role, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
  )
  const count = db.prepare('SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?')

  res.json({
    conversations: rows.map((row) => {
      const last = preview.get(row.id) as { content: string; role: string } | undefined
      return {
        ...row,
        messageCount: (count.get(row.id) as { count: number }).count,
        preview: last ? last.content.slice(0, 140) : '',
      }
    }),
  })
})

chatRouter.post('/conversations', (req, res) => {
  const body = (req.body ?? {}) as { title?: string; agentId?: string | null; kind?: string; model?: string }
  const id = newId()
  const ts = nowIso()
  db.prepare(
    'INSERT INTO conversations (id, title, agent_id, model, kind, created_at, updated_at, pinned) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
  ).run(
    id,
    titleFrom(body.title ?? '', 'New conversation'),
    body.agentId ?? null,
    body.model ?? null,
    body.kind ?? 'chat',
    ts,
    ts,
  )
  res.status(201).json({ conversation: db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) })
})

chatRouter.get('/conversations/:id', (req, res) => {
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as
    | ConversationRow
    | undefined
  if (!conversation) throw new HttpError(404, 'not_found', 'Conversation not found.')
  const messages = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(conversation.id) as MessageRow[]
  res.json({
    conversation,
    messages: messages.map((message) => ({
      ...message,
      attachments: parseAttachments(message.attachments),
    })),
  })
})

chatRouter.patch('/conversations/:id', (req, res) => {
  const body = (req.body ?? {}) as { title?: string; pinned?: boolean; agentId?: string | null }
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as
    | ConversationRow
    | undefined
  if (!conversation) throw new HttpError(404, 'not_found', 'Conversation not found.')
  db.prepare('UPDATE conversations SET title = ?, pinned = ?, agent_id = ?, updated_at = ? WHERE id = ?').run(
    body.title !== undefined ? body.title : conversation.title,
    body.pinned !== undefined ? (body.pinned ? 1 : 0) : conversation.pinned,
    body.agentId !== undefined ? body.agentId : conversation.agent_id,
    nowIso(),
    conversation.id,
  )
  res.json({ conversation: db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversation.id) })
})

chatRouter.delete('/conversations/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(req.params.id)
  db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

/** Removes every message created after `afterMessageId` (or all of them). */
chatRouter.post('/conversations/:id/truncate', (req, res) => {
  const body = (req.body ?? {}) as { afterMessageId?: string | null }
  const conversationId = req.params.id
  if (!body.afterMessageId) {
    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId)
  } else {
    const anchor = db
      .prepare('SELECT created_at FROM messages WHERE id = ? AND conversation_id = ?')
      .get(body.afterMessageId, conversationId) as { created_at: string } | undefined
    if (!anchor) throw new HttpError(404, 'not_found', 'That message no longer exists.')
    db.prepare('DELETE FROM messages WHERE conversation_id = ? AND created_at > ?').run(
      conversationId,
      anchor.created_at,
    )
  }
  touchConversation(conversationId)
  res.json({ ok: true })
})

/** Edits a user message; everything after it is removed so the reply is regenerated. */
chatRouter.put('/messages/:id', (req, res) => {
  const body = (req.body ?? {}) as { content?: string }
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as MessageRow | undefined
  if (!message) throw new HttpError(404, 'not_found', 'Message not found.')
  if (message.role !== 'user') {
    throw new HttpError(400, 'not_editable', 'Only your own messages can be edited.')
  }
  const content = (body.content ?? '').trim()
  if (!content) throw new HttpError(400, 'empty_message', 'A message cannot be empty.')
  db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, message.id)
  db.prepare('DELETE FROM messages WHERE conversation_id = ? AND created_at > ?').run(
    message.conversation_id,
    message.created_at,
  )
  res.json({
    message: { ...message, content },
    conversationId: message.conversation_id,
  })
})

/* --------------------------------- chat --------------------------------- */

interface ChatBody {
  conversationId?: string
  agentId?: string | null
  provider?: string
  model?: string
  content?: string
  attachments?: string[]
  mode?: ChatMode
  reuseUserMessageId?: string
  approvedTools?: string[]
  title?: string
}

chatRouter.post('/chat', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as ChatBody
  const mode: ChatMode = body.mode ?? 'chat'
  const stream = new SseStream(res)
  const controller = new AbortController()
  let aborted = false
  stream.guard('chat', () => {
    aborted = true
    controller.abort()
  })

  try {
    const providerId = body.provider ?? ''
    const modelId = body.model ?? ''
    const adapter = getProvider(providerId)
    if (!adapter.isConfigured()) {
      throw new HttpError(
        503,
        'provider_not_configured',
        `${adapter.label} is not configured.`,
        adapter.configIssue?.() ?? adapter.setupHint,
      )
    }
    const { model } = providerForModel(providerId, modelId)
    if (!model) {
      throw new HttpError(
        400,
        'unknown_model',
        `"${modelId}" is not available for ${adapter.label}.`,
        'Pick a model again from the selector in the composer.',
      )
    }

    const agent = body.agentId ? getAgent(body.agentId) : undefined
    if (body.agentId && !agent) {
      throw new HttpError(404, 'unknown_agent', 'That agent no longer exists.')
    }
    const { systemPrompt, enabledTools } = buildSystemPrompt(agent, mode)
    const costKind = mode === 'summarize' ? 'summarize' : mode === 'research' ? 'research' : 'chat'
    assertAffordable(costKind)

    // Privacy: when conversation storage is switched off in Settings, this
    // exchange is never written to the database - the answer streams and the
    // turns exist only for as long as the window is open.
    const storeHistory = getSetting<Record<string, unknown>>('app', {}).storeHistory !== false

    /* --- user turn (reused when regenerating or editing) --- */
    let conversationId = body.conversationId ?? ''
    let userMessage: MessageRow | undefined
    if (body.reuseUserMessageId) {
      userMessage = db
        .prepare('SELECT * FROM messages WHERE id = ?')
        .get(body.reuseUserMessageId) as MessageRow | undefined
      if (!userMessage) throw new HttpError(404, 'not_found', 'The message being regenerated is gone.')
      conversationId = userMessage.conversation_id
    }

    const attachmentIds = userMessage ? parseAttachments(userMessage.attachments) : (body.attachments ?? [])
    const userText = userMessage ? userMessage.content : (body.content ?? '').trim()
    if (!userMessage && !userText && attachmentIds.length === 0) {
      throw new HttpError(400, 'empty_message', 'Write a message or attach a file first.')
    }

    /* --- consequential tools run before anything is written, so a declined action leaves no trace --- */
    const urls = extractUrls(userText)
    if (urls.length > 0 && enabledTools.includes('web')) {
      const approved = new Set(body.approvedTools ?? [])
      if (!approved.has('web')) {
        throw new HttpError(
          409,
          'tool_confirmation_required',
          'This agent wants to read a web page before answering.',
          JSON.stringify({ tool: 'web', urls: urls.slice(0, 2) }),
        )
      }
    }

    if (conversationId && userMessage && storeHistory) {
      db.prepare('DELETE FROM messages WHERE conversation_id = ? AND created_at > ?').run(
        conversationId,
        userMessage.created_at,
      )
    }

    if (!conversationId) {
      if (storeHistory) {
        conversationId = newId()
        const ts = nowIso()
        db.prepare(
          'INSERT INTO conversations (id, title, agent_id, model, kind, created_at, updated_at, pinned) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
        ).run(
          conversationId,
          titleFrom(body.title ?? body.content ?? '', agent ? agent.name : 'New chat'),
          agent?.id ?? null,
          modelId,
          mode === 'chat' ? 'chat' : mode,
          ts,
          ts,
        )
      } else {
        conversationId = `transient-${newId()}`
      }
    }

    if (!userMessage) {
      const id = newId()
      if (storeHistory) {
        db.prepare(
          'INSERT INTO messages (id, conversation_id, role, content, model, units, attachments, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
        ).run(id, conversationId, 'user', userText, modelId, JSON.stringify(attachmentIds), nowIso())
        userMessage = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow
      } else {
        userMessage = {
          id,
          conversation_id: conversationId,
          role: 'user',
          content: userText,
          model: modelId,
          units: 0,
          attachments: JSON.stringify(attachmentIds),
          error: null,
          created_at: nowIso(),
        }
      }
    }
    if (storeHistory) {
      db.prepare('UPDATE conversations SET model = ?, agent_id = ?, updated_at = ? WHERE id = ?').run(
        modelId,
        agent?.id ?? null,
        nowIso(),
        conversationId,
      )
    }

    /* --- web tool (the user already confirmed it above) --- */
    const webContext: string[] = []
    if (urls.length > 0 && enabledTools.includes('web')) {
      for (const url of urls.slice(0, 2)) {
        try {
          const page = await fetchPageText(url, controller.signal)
          webContext.push(`Fetched page: ${url}\nTitle: ${page.title}\n\n${page.text}`)
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'fetch failed'
          webContext.push(`Attempted to fetch ${url} but it failed: ${reason}. Tell the user the page could not be read.`)
        }
      }
    }

    const memoryContext: string[] = []
    if (enabledTools.includes('memory') || mode === 'chat') {
      const keywords = extractKeywords(userMessage.content)
      if (keywords.length > 0) {
        const like = keywords.map(() => 'content LIKE ?').join(' OR ')
        const rows = db
          .prepare(
            `SELECT role, content, created_at FROM messages
             WHERE conversation_id = ? AND id != ? AND (${like})
             ORDER BY created_at DESC LIMIT 4`,
          )
          .all(conversationId, userMessage.id, ...keywords.map((word) => `%${word}%`)) as Array<{
          role: string
          content: string
        }>
        for (const row of rows) {
          memoryContext.push(`${row.role === 'user' ? 'Earlier you asked' : 'You previously answered'}: ${row.content.slice(0, 800)}`)
        }
      }
    }

    /* --- model input --- */
    const history = db
      .prepare(
        `SELECT * FROM messages WHERE conversation_id = ? AND id != ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(conversationId, userMessage.id, HISTORY_WINDOW) as MessageRow[]

    const messages: ChatMessage[] = [{ role: 'system', content: [{ type: 'text', text: systemPrompt }] }]
    if (webContext.length > 0) {
      messages.push({
        role: 'system',
        content: [
          {
            type: 'text',
            text: `Page content retrieved for this answer. Use it, and cite it as the URL when you rely on it.\n\n${webContext.join('\n\n---\n\n')}`,
          },
        ],
      })
    }
    if (memoryContext.length > 0) {
      messages.push({
        role: 'system',
        content: [
          {
            type: 'text',
            text: `Possibly relevant earlier exchanges (use only if truly relevant):\n\n${memoryContext.join('\n')}`,
          },
        ],
      })
    }
    for (const row of history.reverse()) {
      if (row.error) continue
      messages.push({ role: row.role === 'assistant' ? 'assistant' : 'user', content: [{ type: 'text', text: row.content }] })
    }
    const userParts = buildAttachmentParts(attachmentIds, model)
    if (userMessage.content) userParts.unshift({ type: 'text', text: userMessage.content })
    messages.push({ role: 'user', content: userParts })

    const assistantId = newId()
    stream.send('meta', {
      conversationId,
      userMessageId: userMessage.id,
      assistantMessageId: assistantId,
      provider: adapter.id,
      model: modelId,
      agentId: agent?.id ?? null,
      cost: { kind: costKind, units: mode === 'summarize' ? 2 : mode === 'research' ? 3 : 1 },
      title: titleFrom(body.title ?? userMessage.content, agent ? agent.name : 'New chat'),
    })

    const started = Date.now()
    let streamed = ''
    const result = await adapter.streamChat(
      { model: modelId, messages, signal: controller.signal },
      { onDelta: (delta) => (streamed += delta) },
    )
    const text = result.text || streamed

    const ts = nowIso()
    const displayTitle = titleFrom(userMessage.content || 'Chat', agent ? agent.name : 'New chat')
    if (storeHistory) {
      db.prepare(
        'INSERT INTO messages (id, conversation_id, role, content, model, units, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(assistantId, conversationId, 'assistant', text, modelId, 1, '[]', ts)
      touchConversation(conversationId)
      recordActivity(
        'chat',
        (db.prepare('SELECT title FROM conversations WHERE id = ?').get(conversationId) as { title: string }).title,
        `${adapter.label} · ${model.label}`,
        conversationId,
      )
    }
    const remaining = chargeUnits(costKind, displayTitle, modelId, storeHistory ? conversationId : null)

    const title = storeHistory
      ? (db.prepare('SELECT title FROM conversations WHERE id = ?').get(conversationId) as { title: string }).title
      : displayTitle

    stream.send('usage', {
      units: 1,
      remaining,
      inputTokens: result.usage?.inputTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
      durationMs: Date.now() - started,
    })
    stream.send('done', { conversationId, assistantMessageId: assistantId, title })
    stream.end()
  } catch (error) {
    if (aborted) {
      // The user pressed Stop: keep whatever was generated, charge nothing.
      stream.end()
      return
    }
    stream.fail(error)
    void syncPeriod()
  }
})

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>()"']+/g) ?? []
  return [...new Set(matches)].slice(0, 2)
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'what', 'when', 'how', 'why', 'you', 'your',
  'about', 'from', 'into', 'have', 'has', 'are', 'was', 'were', 'can', 'could', 'would',
  'should', 'please', 'make', 'made', 'give', 'tell', 'write', 'there', 'their', 'them',
])

function extractKeywords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 5 && !STOP_WORDS.has(word)),
    ),
  ].slice(0, 4)
}

export type { ConversationRow, MessageRow }
