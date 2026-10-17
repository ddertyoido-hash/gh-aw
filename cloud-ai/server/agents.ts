/**
 * Built-in agents and the system prompts Cloud AI sends to the model.
 *
 * Agent tools are enforced server-side:
 *  - `files`  : attachments are passed to the model (always allowed)
 *  - `memory` : earlier messages from the same conversation may be recalled
 *  - `web`    : a URL in the message may be fetched - this is a consequential
 *               action, so the server asks the client for explicit
 *               confirmation before performing it
 */
import { db, newId, nowIso } from './db.js'

export interface AgentRow {
  id: string
  name: string
  icon: string
  color: string
  description: string
  instructions: string
  model: string | null
  tools: string
  builtin: number
  created_at: string
  updated_at: string
}

export interface AgentTool {
  id: 'files' | 'memory' | 'web'
  label: string
  description: string
  /** Requires an explicit user confirmation before the server runs it. */
  consequential: boolean
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    id: 'files',
    label: 'Attached files',
    description: 'Read the images, PDFs and text files attached to the message.',
    consequential: false,
  },
  {
    id: 'memory',
    label: 'Conversation memory',
    description: 'Recall relevant parts of this conversation that are outside the recent window.',
    consequential: false,
  },
  {
    id: 'web',
    label: 'Read a web page',
    description: 'Fetch a URL you include in the message and use its text as context.',
    consequential: true,
  },
]

const BUILTIN_AGENTS = [
  {
    id: 'agent-research',
    name: 'Research Agent',
    icon: 'telescope',
    color: '#0ea5e9',
    description: 'Investigates a topic, compares sources and organises findings into a briefing.',
    instructions:
      'You are a meticulous research assistant. Break the question into sub-questions, work through them in order, and separate established facts from open questions. Always finish with a short "Key findings" list and a "Still unclear" list. Never invent sources: if you were not given a page or a file to read, say what you would need.',
    tools: ['memory', 'web'],
  },
  {
    id: 'agent-writing',
    name: 'Writing Agent',
    icon: 'pen',
    color: '#8b5cf6',
    description: 'Drafts and edits emails, articles, stories and professional documents.',
    instructions:
      'You are an experienced editor. Ask at most one clarifying question when the brief is ambiguous, otherwise get straight to a strong first draft. Match the requested tone and length, prefer concrete language, and offer a tighter alternative version when the text runs long.',
    tools: ['files', 'memory'],
  },
  {
    id: 'agent-creative',
    name: 'Creative Agent',
    icon: 'sparkles',
    color: '#ec4899',
    description: 'Brainstorms ideas, names, campaign angles and image prompts.',
    instructions:
      'You are a creative director. Generate distinct directions rather than variations of one idea, give each a name and one sentence of rationale, then recommend a favourite and say why. When asked for imagery, describe the prompt in enough detail to be used directly for image generation.',
    tools: ['memory'],
  },
  {
    id: 'agent-coding',
    name: 'Coding Agent',
    icon: 'code',
    color: '#14b8a6',
    description: 'Explains, reviews and writes code with clear reasoning.',
    instructions:
      'You are a senior engineer. Explain trade-offs before choosing an approach, write complete runnable snippets, and point out edge cases, failure modes and tests that matter. Never claim code was executed - say what you reasoned about and what still needs to be verified.',
    tools: ['files', 'memory'],
  },
] as const

export function ensureBuiltinAgents(): void {
  const count = (db.prepare('SELECT COUNT(*) AS count FROM agents').get() as { count: number }).count
  if (count > 0) return
  const insert = db.prepare(
    `INSERT INTO agents (id, name, icon, color, description, instructions, model, tools, builtin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?)`,
  )
  const ts = nowIso()
  for (const agent of BUILTIN_AGENTS) {
    insert.run(
      agent.id,
      agent.name,
      agent.icon,
      agent.color,
      agent.description,
      agent.instructions,
      JSON.stringify(agent.tools),
      ts,
      ts,
    )
  }
}

export function getAgent(id: string): AgentRow | undefined {
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined
}

export function listAgents(): AgentRow[] {
  return db
    .prepare('SELECT * FROM agents ORDER BY builtin DESC, created_at ASC')
    .all() as AgentRow[]
}

export function agentTools(agent: AgentRow): string[] {
  try {
    const parsed = JSON.parse(agent.tools) as unknown
    return Array.isArray(parsed) ? parsed.filter((tool): tool is string => typeof tool === 'string') : []
  } catch {
    return []
  }
}

export type ChatMode = 'chat' | 'summarize' | 'research' | 'create'

const MODE_PROMPTS: Record<ChatMode, string> = {
  chat: 'You are Cloud AI, a calm and precise desktop assistant. Answer directly, use Markdown when it helps, and keep formatting light.',
  summarize:
    'You are a summarisation specialist. Return a short overview first, then the key points as a list, then any action items. Quote exact figures when the source contains them, and never add information that is not in the material.',
  research:
    'You are a research assistant. Structure the answer as: question restated, findings grouped by theme, what is well established vs uncertain, and suggested next steps. State clearly when you are reasoning without an external source.',
  create:
    'You are a writing partner. Produce the requested piece in full, respect the stated tone and length, and keep formatting clean unless structure was requested.',
}

export interface AgentContext {
  systemPrompt: string
  enabledTools: string[]
}

export function buildSystemPrompt(agent: AgentRow | undefined, mode: ChatMode): AgentContext {
  const parts: string[] = []
  if (agent) {
    parts.push(agent.instructions)
    parts.push(`You are running as the "${agent.name}" agent inside Cloud AI.`)
  } else {
    parts.push(MODE_PROMPTS[mode])
  }
  if (agent && mode !== 'chat') parts.push(MODE_PROMPTS[mode])
  if (agent) {
    const tools = agentTools(agent)
    if (!tools.includes('web')) {
      parts.push('You cannot browse the web in this session. If a current fact is required, say so plainly.')
    }
  } else {
    parts.push('You have no browsing access; do not claim to have looked anything up.')
  }
  return { systemPrompt: parts.join('\n\n'), enabledTools: agent ? agentTools(agent) : [] }
}

/** Creates an agent id for custom agents. */
export const agentId = () => `agent-${newId().slice(0, 8)}`
