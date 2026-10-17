/**
 * Research workspace: turn a question into an organised briefing.
 *
 * Runs through the Research agent so the server-side prompt pushes for
 * structure (findings, what is uncertain, next steps). When the message
 * contains a link and the agent's web tool is enabled, the page is fetched only
 * after you confirm it.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Globe2, Lightbulb, ListChecks, Search, ShieldCheck } from 'lucide-react'
import { consumePendingPrompt } from '../../lib/promptBus'
import { useAppStore } from '../../store/app'
import { useChatStore } from '../../store/chat'
import { Button, Input } from '../common/Controls'
import { ThreadView } from '../chat/ThreadView'

const DEPTHS = [
  { id: 'quick', label: 'Quick overview', prompt: 'Give me a quick overview of: ' },
  { id: 'deep', label: 'Deep dive', prompt: 'Research this thoroughly and organise the findings: ' },
  { id: 'compare', label: 'Compare options', prompt: 'Compare the main options for: ' },
  { id: 'brief', label: 'Decision brief', prompt: 'Write a decision brief on: ' },
]

export function ResearchView() {
  const agents = useAppStore((state) => state.agents)
  const pushToast = useAppStore((state) => state.pushToast)
  const startNew = useChatStore((state) => state.startNew)
  const send = useChatStore((state) => state.send)
  const [topic, setTopic] = useState('')
  const [depth, setDepth] = useState(DEPTHS[0].id)

  const researchAgent = agents.find((agent) => agent.id === 'agent-research') ?? null
  const webEnabled = researchAgent?.tools.includes('web') ?? false

  useEffect(() => {
    const pending = consumePendingPrompt()
    if (pending?.text) setTopic(pending.text)
  }, [])

  const start = async () => {
    const trimmed = topic.trim()
    if (!trimmed) {
      pushToast({ tone: 'info', title: 'What should we research?', description: 'Enter a topic or question first.' })
      return
    }
    const selected = DEPTHS.find((candidate) => candidate.id === depth) ?? DEPTHS[0]
    startNew({ agentId: researchAgent?.id ?? null, mode: 'research' })
    await send({
      content: `${selected.prompt}${trimmed}`,
      provider: useAppStore.getState().settings.defaultProvider,
      model: useAppStore.getState().settings.defaultModel,
      mode: 'research',
      agentId: researchAgent?.id ?? null,
      title: trimmed.slice(0, 60),
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/30 px-4 py-3 sm:px-6 dark:border-white/10">
        <div className="mx-auto max-w-3xl space-y-3">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-ink">Research</h1>
            <p className="text-[12.5px] text-ink-muted">
              Ask a question and Cloud AI structures the answer: findings, uncertainty, and where to look next.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <Input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void start()
                }}
                placeholder="e.g. How do EU AI Act obligations affect small SaaS teams?"
                className="pl-9"
              />
            </div>
            <Button variant="primary" icon={<Lightbulb size={15} />} onClick={() => void start()}>
              Start research
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {DEPTHS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setDepth(option.id)}
                aria-pressed={depth === option.id}
                className={
                  depth === option.id
                    ? 'rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[12px] font-medium text-ink shadow-sm dark:border-white/25 dark:bg-white/15'
                    : 'rounded-full border border-white/50 bg-white/40 px-3 py-1 text-[12px] text-ink-soft transition hover:bg-white/60 dark:border-white/10 dark:bg-white/5'
                }
              >
                {option.label}
              </button>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap items-center gap-3 text-[11.5px] text-ink-muted"
          >
            <span className="inline-flex items-center gap-1.5">
              <ListChecks size={13} /> Structured briefing format
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Globe2 size={13} />
              {webEnabled ? 'Web tool enabled — links need your confirmation' : 'No web access for this agent'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={13} /> Sources are only claimed when actually read
            </span>
          </motion.div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <div className="mx-auto h-full max-w-3xl">
          <ThreadView
            mode="research"
            agentId={researchAgent?.id ?? null}
            placeholder="Add a follow-up question, or paste a link to read…"
            emptyTitle="No research session yet"
            emptyDescription="Enter a topic above. Include a link to have the Research agent read that page first (it will ask for confirmation)."
            suggestions={[
              'Compare the leading vector databases for a 10-person team',
              'What changed in the EU AI Act for small SaaS companies?',
              'Summarise the trade-offs of self-hosting an LLM',
            ]}
          />
        </div>
      </div>
    </div>
  )
}
