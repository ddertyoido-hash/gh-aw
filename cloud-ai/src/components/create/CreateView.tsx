/**
 * Create: writing workspace. Templates scaffold a prompt, the Writing agent
 * drafts it with streaming, and everything is saved as a conversation you can
 * reopen from History.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, FileText, Mail, Megaphone, PenLine, Sparkles } from 'lucide-react'
import { consumePendingPrompt } from '../../lib/promptBus'
import { navigate } from '../../lib/router'
import { useAppStore } from '../../store/app'
import { useChatStore } from '../../store/chat'
import { cn } from '../../lib/utils'
import { Button, Select } from '../common/Controls'
import { ThreadView } from '../chat/ThreadView'

const TEMPLATES = [
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    scaffold: 'Write a professional email about ',
    hint: 'Short, clear, ready to send',
  },
  {
    id: 'article',
    label: 'Article',
    icon: FileText,
    scaffold: 'Write an 800-word article about ',
    hint: 'Structured with headings',
  },
  {
    id: 'story',
    label: 'Story',
    icon: BookOpen,
    scaffold: 'Write a short story about ',
    hint: 'Narrative voice, vivid detail',
  },
  {
    id: 'report',
    label: 'Report',
    icon: PenLine,
    scaffold: 'Write a concise business report about ',
    hint: 'Summary, findings, recommendations',
  },
  {
    id: 'social',
    label: 'Social post',
    icon: Megaphone,
    scaffold: 'Write three social media posts about ',
    hint: 'Punchy, varied angles',
  },
  {
    id: 'rewrite',
    label: 'Rewrite',
    icon: Sparkles,
    scaffold: 'Rewrite the following text to be clearer and shorter:\n\n',
    hint: 'Tighter, same meaning',
  },
]

export function CreateView() {
  const agents = useAppStore((state) => state.agents)
  const startNew = useChatStore((state) => state.startNew)
  const agentId = useChatStore((state) => state.agentId)
  const [scaffold, setScaffold] = useState<string | null>(null)
  const [pickedAgent, setPickedAgent] = useState<string | null>(agentId)

  const writingAgents = useMemo(() => agents, [agents])

  useEffect(() => {
    const pending = consumePendingPrompt()
    if (pending) {
      setScaffold(pending.text)
      if (pending.agentId !== undefined) setPickedAgent(pending.agentId)
    }
  }, [])

  useEffect(() => {
    if (!pickedAgent) {
      const writing = agents.find((agent) => agent.id === 'agent-writing')
      if (writing) setPickedAgent(writing.id)
    }
  }, [agents, pickedAgent])

  /** Templates seed the composer so the user adds the topic before sending. */
  const useTemplate = (templateId: string) => {
    const template = TEMPLATES.find((candidate) => candidate.id === templateId)
    if (!template) return
    startNew({ agentId: pickedAgent, mode: 'create' })
    setScaffold(template.scaffold)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/30 px-4 py-3 sm:px-6 dark:border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-ink">Create</h1>
            <p className="text-[12.5px] text-ink-muted">
              Emails, articles, stories and documents - drafted with streaming and saved automatically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ink-muted">Agent</span>
            <Select
              value={pickedAgent ?? ''}
              onChange={(event) => {
                setPickedAgent(event.target.value || null)
                startNew({ agentId: event.target.value || null, mode: 'create' })
              }}
              className="w-[210px]"
            >
              <option value="">Cloud AI default</option>
              {writingAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full max-w-3xl flex-col">
          <div className="flex flex-wrap gap-2 px-4 pt-4 sm:px-6">
            {TEMPLATES.map((template, index) => {
              const Icon = template.icon
              return (
                <motion.button
                  key={template.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  whileHover={{ y: -2 }}
                  onClick={() => useTemplate(template.id)}
                  className={cn(
                    'glass flex items-center gap-2 rounded-2xl px-3 py-2 text-left transition hover:shadow-lift',
                  )}
                  title={template.hint}
                >
                  <Icon size={15} className="text-[color:var(--aurora-blue)]" />
                  <span className="text-[12.5px] font-medium text-ink">{template.label}</span>
                </motion.button>
              )
            })}
          </div>

          {scaffold && (
            <div className="px-4 pt-2 text-[12px] text-ink-muted sm:px-6">
              Template scaffold sent. Continue in the thread below or{' '}
              <button type="button" className="font-medium text-[color:var(--aurora-blue)]" onClick={() => navigate('/chat')}>
                open it in Chat
              </button>
              .
            </div>
          )}

          <div className="min-h-0 flex-1">
            <ThreadView
              mode="create"
              agentId={pickedAgent}
              prefill={scaffold}
              placeholder="Describe what you want written…"
              emptyTitle="What should we write?"
              emptyDescription="Pick a template above or describe the piece you need — tone, length and audience help."
              suggestions={[
                'A friendly follow-up email to a client who has not replied',
                'A launch announcement for a new feature',
                'A 600-word explainer for a non-technical audience',
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
