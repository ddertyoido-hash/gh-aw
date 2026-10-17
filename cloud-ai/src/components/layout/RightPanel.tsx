/**
 * Right panel: recent activity, quick actions and the user's AI agents.
 * Collapses away gracefully in smaller windows and opens as an overlay drawer.
 */
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Clock, Sparkles, X } from 'lucide-react'
import { QUICK_ACTIONS } from '../../lib/defaults'
import { setPendingPrompt } from '../../lib/promptBus'
import { navigate } from '../../lib/router'
import { useAppStore } from '../../store/app'
import { useChatStore } from '../../store/chat'
import { cn, formatRelative, truncate } from '../../lib/utils'
import { IconButton } from '../common/Controls'
import { EmptyState } from '../common/States'
import { iconFor } from '../common/icons'

type ActivityFilter = 'all' | 'chat' | 'image' | 'research'

const FILTERS: Array<{ id: ActivityFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'chat', label: 'Chats' },
  { id: 'image', label: 'Images' },
  { id: 'research', label: 'Research' },
]

export function RightPanel({ onClose }: { onClose?: () => void }) {
  const activity = useAppStore((state) => state.activity)
  const agents = useAppStore((state) => state.agents)
  const pushToast = useAppStore((state) => state.pushToast)
  const startNew = useChatStore((state) => state.startNew)
  const [filter, setFilter] = useState<ActivityFilter>('all')

  const items = useMemo(
    () => (filter === 'all' ? activity : activity.filter((item) => item.kind === filter)),
    [activity, filter],
  )

  const openActivity = (kind: string, refId: string | null) => {
    if (kind === 'chat' && refId) {
      navigate(`/chat?c=${refId}`)
    } else if (kind === 'image') {
      navigate('/images')
    } else if (kind === 'research') {
      navigate(refId ? `/chat?c=${refId}` : '/research')
    } else if (kind === 'document') {
      navigate(refId ? `/chat?c=${refId}` : '/create')
    } else {
      navigate('/history')
    }
    onClose?.()
  }

  const launchQuickAction = (actionId: string) => {
    const action = QUICK_ACTIONS.find((candidate) => candidate.id === actionId)
    if (!action) return
    if (action.id === 'quick-image') {
      setPendingPrompt({ text: action.prompt, action: 'compose' })
      navigate('/images')
    } else if (action.id === 'quick-analyze') {
      setPendingPrompt({ text: action.prompt, mode: 'chat' })
      navigate('/chat')
    } else {
      setPendingPrompt({ text: action.prompt, mode: action.mode })
      navigate('/create')
    }
    onClose?.()
  }

  const launchAgent = (agentId: string) => {
    const agent = agents.find((candidate) => candidate.id === agentId)
    startNew({ agentId, mode: 'chat' })
    navigate('/chat')
    if (agent) {
      pushToast({ tone: 'info', title: `${agent.name} ready`, description: 'Ask your question to start the session.' })
    }
    onClose?.()
  }

  return (
    <aside className="flex h-full w-[312px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/35 p-3 dark:border-white/10">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Insights</h2>
        {onClose && (
          <IconButton label="Close insights panel" onClick={onClose} size="sm">
            <X size={16} />
          </IconButton>
        )}
      </div>

      {/* ------------------------------ recent ------------------------------ */}
      <section className="glass rounded-3xl p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
            <Clock size={14} className="text-[color:var(--aurora-blue)]" />
            Recent activity
          </h3>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[color:var(--aurora-blue)] transition hover:opacity-80"
          >
            All
            <ArrowUpRight size={13} />
          </button>
        </div>

        <div className="mb-2 flex flex-wrap gap-1">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11.5px] font-medium transition',
                filter === option.id
                  ? 'bg-white/80 text-ink shadow-sm dark:bg-white/15'
                  : 'text-ink-muted hover:bg-white/50 dark:hover:bg-white/10',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <EmptyState
            className="py-6"
            icon={<Sparkles size={18} />}
            title="Nothing here yet"
            description="Your chats, images and research sessions will appear here as you use Cloud AI."
          />
        ) : (
          <ul className="space-y-1">
            {items.slice(0, 7).map((item) => {
              const Icon = iconFor(item.kind === 'image' ? 'image' : item.kind === 'research' ? 'telescope' : item.kind === 'document' ? 'file' : 'message')
              return (
                <li key={item.id}>
                  <motion.button
                    type="button"
                    whileHover={{ x: 2 }}
                    onClick={() => openActivity(item.kind, item.ref_id)}
                    className="flex w-full items-start gap-2.5 rounded-2xl px-2 py-2 text-left transition hover:bg-white/55 dark:hover:bg-white/10"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/60 text-ink-soft dark:bg-white/10">
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{truncate(item.title, 46)}</span>
                      <span className="block truncate text-[11.5px] text-ink-muted">
                        {item.subtitle} · {formatRelative(item.ts)}
                      </span>
                    </span>
                  </motion.button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* --------------------------- quick actions --------------------------- */}
      <section className="glass rounded-3xl p-3.5">
        <h3 className="mb-2.5 text-[13.5px] font-semibold text-ink">Quick actions</h3>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = iconFor(action.icon)
            return (
              <motion.button
                key={action.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => launchQuickAction(action.id)}
                title={action.description}
                className="flex flex-col items-start gap-1.5 rounded-2xl border border-white/50 bg-white/45 p-2.5 text-left transition hover:bg-white/70 focus-ring dark:border-white/10 dark:bg-white/5"
              >
                <Icon size={16} className="text-[color:var(--aurora-blue)]" />
                <span className="text-[12.5px] font-medium leading-tight text-ink">{action.label}</span>
              </motion.button>
            )
          })}
        </div>
      </section>

      {/* ------------------------------ agents ------------------------------ */}
      <section className="glass rounded-3xl p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-ink">Your AI agents</h3>
          <button
            type="button"
            onClick={() => navigate('/agents')}
            className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[color:var(--aurora-blue)] transition hover:opacity-80"
          >
            Manage
            <ArrowUpRight size={13} />
          </button>
        </div>
        <ul className="space-y-1">
          {agents.map((agent) => {
            const Icon = iconFor(agent.icon)
            return (
              <li key={agent.id}>
                <div className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5 transition hover:bg-white/55 dark:hover:bg-white/10">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                    style={{ background: agent.color }}
                  >
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{agent.name}</span>
                    <span className="block truncate text-[11.5px] text-ink-muted">
                      {agent.tools.length > 0 ? agent.tools.join(' · ') : 'no tools'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => launchAgent(agent.id)}
                    className="rounded-xl border border-white/50 bg-white/55 px-2 py-1 text-[11.5px] font-medium text-ink-soft transition hover:bg-white/80 focus-ring dark:border-white/15 dark:bg-white/10 dark:text-slate-200"
                  >
                    Launch
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </aside>
  )
}
