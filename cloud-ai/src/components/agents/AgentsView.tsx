/**
 * Agents workspace: discover the built-in agents, create your own, and manage
 * exactly which tools each one may use. Consequential tools (reading a web
 * page) always require a confirmation at run time.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, Pencil, Play, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { api, ApiFailure, type Agent } from '../../lib/api'
import { navigate } from '../../lib/router'
import { useAppStore } from '../../store/app'
import { useChatStore } from '../../store/chat'
import { cn, formatRelative } from '../../lib/utils'
import { Button, Field, IconButton, Input, Select, Textarea, Toggle } from '../common/Controls'
import { EmptyState } from '../common/States'
import { Modal } from '../common/Modal'
import { iconFor } from '../common/icons'

const ICON_CHOICES = ['sparkles', 'telescope', 'pen', 'code', 'image', 'list', 'file', 'mail', 'search', 'robot']
const COLOR_CHOICES = ['#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#22c55e', '#64748b']

interface DraftState {
  id?: string
  name: string
  icon: string
  color: string
  description: string
  instructions: string
  model: string
  tools: string[]
}

const EMPTY_DRAFT: DraftState = {
  name: '',
  icon: 'sparkles',
  color: '#3b82f6',
  description: '',
  instructions: '',
  model: '',
  tools: ['files', 'memory'],
}

export function AgentsView() {
  const agents = useAppStore((state) => state.agents)
  const agentTools = useAppStore((state) => state.agentTools)
  const refreshAgents = useAppStore((state) => state.refreshAgents)
  const pushToast = useAppStore((state) => state.pushToast)
  const providers = useAppStore((state) => state.providers)
  const startNew = useChatStore((state) => state.startNew)

  const [draft, setDraft] = useState<DraftState | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Agent | null>(null)

  useEffect(() => {
    void refreshAgents()
  }, [refreshAgents])

  const models = useMemo(
    () =>
      providers
        .filter((provider) => provider.configured)
        .flatMap((provider) =>
          provider.models
            .filter((model) => model.capabilities.includes('text'))
            .map((model) => ({ id: model.id, label: `${provider.label} · ${model.label}` })),
        ),
    [providers],
  )

  const launch = (agent: Agent) => {
    startNew({ agentId: agent.id, mode: 'chat' })
    navigate('/chat')
    pushToast({ tone: 'info', title: `${agent.name} ready`, description: 'The agent will stay on for this session.' })
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const payload = {
        name: draft.name.trim(),
        icon: draft.icon,
        color: draft.color,
        description: draft.description.trim(),
        instructions: draft.instructions.trim(),
        model: draft.model || null,
        tools: draft.tools,
      }
      if (draft.id) await api.updateAgent(draft.id, payload)
      else await api.createAgent(payload)
      await refreshAgents()
      setDraft(null)
      pushToast({ tone: 'success', title: draft.id ? 'Agent updated' : 'Agent created' })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'The agent was not saved',
        description: error instanceof ApiFailure ? error.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirmDelete) return
    try {
      await api.deleteAgent(confirmDelete.id)
      await refreshAgents()
      pushToast({ tone: 'success', title: `${confirmDelete.name} deleted` })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not delete the agent',
        description: error instanceof ApiFailure ? error.message : undefined,
      })
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 pb-28 pt-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">AI agents</h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            Specialised assistants with their own instructions and tools. They only ever run what you enable.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setDraft({ ...EMPTY_DRAFT })}>
          New agent
        </Button>
      </header>

      {agents.length === 0 ? (
        <div className="glass rounded-3xl">
          <EmptyState
            icon={<Bot size={20} />}
            title="No agents yet"
            description="Create an agent with its own instructions, preferred model and tools."
            action={
              <Button variant="soft" icon={<Plus size={14} />} onClick={() => setDraft({ ...EMPTY_DRAFT })}>
                Create the first agent
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((agent) => {
            const Icon = iconFor(agent.icon)
            return (
              <motion.article
                key={agent.id}
                whileHover={{ y: -3 }}
                className="glass flex flex-col gap-3 rounded-3xl p-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lift"
                    style={{ background: agent.color }}
                  >
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-[15px] font-semibold text-ink">{agent.name}</h2>
                      {agent.builtin && (
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-muted dark:bg-white/10">
                          built-in
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-ink-muted">{agent.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {agent.tools.length === 0 ? (
                    <span className="text-[12px] text-ink-muted">No tools enabled</span>
                  ) : (
                    agent.tools.map((tool) => {
                      const info = agentTools.find((candidate) => candidate.id === tool)
                      return (
                        <span
                          key={tool}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px]',
                            info?.consequential
                              ? 'border-amber-300/70 bg-amber-100/70 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100'
                              : 'border-white/50 bg-white/60 text-ink-soft dark:border-white/15 dark:bg-white/10',
                          )}
                          title={info?.description}
                        >
                          {info?.consequential && <ShieldCheck size={11} />}
                          {info?.label ?? tool}
                        </span>
                      )
                    })
                  )}
                </div>

                {agent.recentConversations.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-muted">
                      Recent sessions
                    </div>
                    {agent.recentConversations.slice(0, 3).map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => navigate(`/chat?c=${conversation.id}`)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1 text-left transition hover:bg-white/55 dark:hover:bg-white/10"
                      >
                        <span className="truncate text-[12.5px] text-ink-soft">{conversation.title}</span>
                        <span className="shrink-0 text-[11px] text-ink-muted">{formatRelative(conversation.updated_at)}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex items-center gap-2">
                  <Button size="sm" variant="primary" icon={<Play size={14} />} onClick={() => launch(agent)}>
                    Launch
                  </Button>
                  <Button
                    size="sm"
                    variant="soft"
                    icon={<Pencil size={14} />}
                    onClick={() =>
                      setDraft({
                        id: agent.id,
                        name: agent.name,
                        icon: agent.icon,
                        color: agent.color,
                        description: agent.description,
                        instructions: agent.instructions,
                        model: agent.model ?? '',
                        tools: agent.tools,
                      })
                    }
                  >
                    Edit
                  </Button>
                  {!agent.builtin && (
                    <IconButton
                      label={`Delete ${agent.name}`}
                      size="sm"
                      className="ml-auto text-rose-500"
                      onClick={() => setConfirmDelete(agent)}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  )}
                </div>
              </motion.article>
            )
          })}
        </div>
      )}

      {/* ------------------------------ editor ------------------------------ */}
      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        width="lg"
        title={draft?.id ? 'Edit agent' : 'Create an agent'}
        description="Instructions shape how the agent answers. Tools decide what it is allowed to do."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={!draft?.name.trim() || !draft?.instructions.trim()}
              onClick={() => void save()}
            >
              {draft?.id ? 'Save changes' : 'Create agent'}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Agent name">
                <Input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="Product researcher"
                />
              </Field>
              <Field label="Preferred model" hint="Leave on “Current model” to follow the composer selection.">
                <Select value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })}>
                  <option value="">Current model</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Description">
              <Input
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="What this agent is best at"
              />
            </Field>

            <Field label="Icon and colour">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {ICON_CHOICES.map((icon) => {
                    const Icon = iconFor(icon)
                    return (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setDraft({ ...draft, icon })}
                        aria-pressed={draft.icon === icon}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl border transition',
                          draft.icon === icon
                            ? 'border-white/80 bg-white/85 text-ink shadow-sm dark:border-white/25 dark:bg-white/15'
                            : 'border-white/50 bg-white/40 text-ink-soft hover:bg-white/60 dark:border-white/10 dark:bg-white/5',
                        )}
                      >
                        <Icon size={16} />
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {COLOR_CHOICES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setDraft({ ...draft, color })}
                      aria-label={`Use colour ${color}`}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition',
                        draft.color === color ? 'border-white shadow-lift' : 'border-transparent',
                      )}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>
            </Field>

            <Field label="System instructions" hint="This is sent to the model before every reply from this agent.">
              <Textarea
                rows={6}
                value={draft.instructions}
                onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
                placeholder="You are a meticulous researcher. Always separate established facts from open questions…"
              />
            </Field>

            <div>
              <div className="mb-1 text-[12px] font-medium uppercase tracking-wide text-ink-muted">Allowed tools</div>
              <div className="divide-y divide-white/40 rounded-2xl border border-white/50 bg-white/40 px-3 dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
                {agentTools.map((tool) => (
                  <Toggle
                    key={tool.id}
                    label={tool.label}
                    description={`${tool.description}${tool.consequential ? ' Asks for confirmation each time.' : ''}`}
                    checked={draft.tools.includes(tool.id)}
                    onChange={(checked) =>
                      setDraft({
                        ...draft,
                        tools: checked
                          ? [...draft.tools, tool.id]
                          : draft.tools.filter((candidate) => candidate !== tool.id),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name ?? 'agent'}?`}
        description="Its conversations stay in History, but the agent configuration is removed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Keep it
            </Button>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => void remove()}>
              Delete agent
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-ink-soft">
          You can recreate it later from scratch. Built-in agents cannot be deleted.
        </p>
      </Modal>
    </div>
  )
}
