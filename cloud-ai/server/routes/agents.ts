/**
 * Agent routes: list, create, update, delete plus the tool catalogue and each
 * agent's conversation history.
 */
import { Router } from 'express'
import { AGENT_TOOLS, agentId, listAgents, type AgentRow } from '../agents.js'
import { db, nowIso } from '../db.js'
import { HttpError } from '../types.js'

export const agentsRouter = Router()

interface AgentBody {
  name?: string
  icon?: string
  color?: string
  description?: string
  instructions?: string
  model?: string | null
  tools?: string[]
}

function serialize(agent: AgentRow) {
  let tools: string[] = []
  try {
    const parsed = JSON.parse(agent.tools) as unknown
    if (Array.isArray(parsed)) tools = parsed.filter((tool): tool is string => typeof tool === 'string')
  } catch {
    tools = []
  }
  const conversations = db
    .prepare('SELECT COUNT(*) AS count FROM conversations WHERE agent_id = ?')
    .get(agent.id) as { count: number }
  return {
    ...agent,
    tools,
    builtin: Boolean(agent.builtin),
    conversationCount: conversations.count,
    recentConversations: db
      .prepare('SELECT id, title, updated_at FROM conversations WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 5')
      .all(agent.id),
  }
}

function validateTools(tools: string[] | undefined): string[] {
  if (!tools) return []
  const valid = AGENT_TOOLS.map((tool) => tool.id) as string[]
  const unknown = tools.filter((tool) => !valid.includes(tool))
  if (unknown.length > 0) {
    throw new HttpError(400, 'unknown_tool', `Unknown agent tool: ${unknown.join(', ')}`)
  }
  return tools
}

agentsRouter.get('/agents', (_req, res) => {
  res.json({ agents: listAgents().map(serialize), tools: AGENT_TOOLS })
})

agentsRouter.post('/agents', (req, res) => {
  const body = (req.body ?? {}) as AgentBody
  const name = (body.name ?? '').trim()
  if (!name) throw new HttpError(400, 'missing_name', 'Give the agent a name.')
  const instructions = (body.instructions ?? '').trim()
  if (!instructions) {
    throw new HttpError(400, 'missing_instructions', 'Describe how the agent should behave.')
  }
  const tools = validateTools(body.tools)
  const id = agentId()
  const ts = nowIso()
  db.prepare(
    `INSERT INTO agents (id, name, icon, color, description, instructions, model, tools, builtin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(
    id,
    name,
    body.icon ?? 'sparkles',
    body.color ?? '#3b82f6',
    (body.description ?? '').trim(),
    instructions,
    body.model ?? null,
    JSON.stringify(tools),
    ts,
    ts,
  )
  res.status(201).json({ agent: serialize(db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow) })
})

agentsRouter.patch('/agents/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as AgentRow | undefined
  if (!existing) throw new HttpError(404, 'not_found', 'Agent not found.')
  const body = (req.body ?? {}) as AgentBody
  const tools = body.tools ? validateTools(body.tools) : undefined
  db.prepare(
    `UPDATE agents SET name = ?, icon = ?, color = ?, description = ?, instructions = ?, model = ?, tools = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    body.name?.trim() || existing.name,
    body.icon ?? existing.icon,
    body.color ?? existing.color,
    body.description !== undefined ? body.description.trim() : existing.description,
    body.instructions?.trim() || existing.instructions,
    body.model !== undefined ? body.model : existing.model,
    tools ? JSON.stringify(tools) : existing.tools,
    nowIso(),
    existing.id,
  )
  res.json({
    agent: serialize(db.prepare('SELECT * FROM agents WHERE id = ?').get(existing.id) as AgentRow),
  })
})

agentsRouter.delete('/agents/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as AgentRow | undefined
  if (!existing) throw new HttpError(404, 'not_found', 'Agent not found.')
  db.prepare('UPDATE conversations SET agent_id = NULL WHERE agent_id = ?').run(existing.id)
  db.prepare('DELETE FROM agents WHERE id = ?').run(existing.id)
  res.json({ ok: true })
})
