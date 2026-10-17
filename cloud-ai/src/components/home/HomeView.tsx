/**
 * Home screen: greeting, the hero composer, the action cards and - only when no
 * provider is connected - the setup screen explaining how to add a key.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Zap } from 'lucide-react'
import { consumePendingPrompt } from '../../lib/promptBus'
import { navigate } from '../../lib/router'
import { greeting } from '../../lib/utils'
import { useAppStore } from '../../store/app'
import { useChatStore, type ChatMode } from '../../store/chat'
import { PromptComposer } from '../composer/PromptComposer'
import { ActionCards } from './ActionCards'
import { ProviderSetupScreen } from '../common/States'

export function HomeView() {
  const settings = useAppStore((state) => state.settings)
  const providers = useAppStore((state) => state.providers)
  const units = useAppStore((state) => state.units)
  const startNew = useChatStore((state) => state.startNew)
  const send = useChatStore((state) => state.send)
  const streaming = useChatStore((state) => state.streaming)

  const [text, setText] = useState('')
  const [mode, setMode] = useState<ChatMode>('chat')

  const anyConfigured = providers.some((provider) => provider.configured)

  // Quick actions, action cards and the command palette hand work over here.
  useEffect(() => {
    const pending = consumePendingPrompt()
    if (!pending) return
    setText(pending.text)
    if (pending.mode) setMode(pending.mode)
  }, [])

  const handleSubmit = async ({ content, attachments, mode: submitMode }: { content: string; attachments: string[]; mode: ChatMode }) => {
    startNew({ mode: submitMode })
    navigate('/chat')
    await send({
      content,
      attachments,
      mode: submitMode,
      provider: settings.defaultProvider,
      model: settings.defaultModel,
      agentId: null,
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 pb-28 pt-8 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[38px]">
          <span className="aurora-text">{greeting()}.</span> How can I help?
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-[14px] leading-relaxed text-ink-soft">
          Your personal AI assistant for ideas, creativity, research, and productivity.
        </p>
      </motion.div>

      <div className="flex w-full justify-center">
        <PromptComposer
          value={text}
          onValueChange={setText}
          onSubmit={handleSubmit}
          mode={mode}
          onModeChange={setMode}
          streaming={streaming}
          onStop={() => useChatStore.getState().stop()}
          autoFocus
        />
      </div>

      {units && units.remaining === 0 && (
        <div className="glass mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[13px] text-ink-soft">
            <Zap size={15} className="text-amber-500" />
            You have used all AI units for this period.
          </span>
          <button
            type="button"
            onClick={() => navigate('/settings?tab=plan')}
            className="rounded-xl border border-white/50 bg-white/60 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition hover:bg-white/80 dark:border-white/15 dark:bg-white/10 dark:text-slate-200"
          >
            View plans
          </button>
        </div>
      )}

      {anyConfigured ? (
        <div className="mt-1">
          <div className="mb-3 flex items-center gap-2 px-1">
            <Sparkles size={15} className="text-[color:var(--aurora-blue)]" />
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Start something</h2>
          </div>
          <ActionCards />
        </div>
      ) : (
        <ProviderSetupScreen providers={providers} onOpenSettings={() => navigate('/settings?tab=providers')} />
      )}
    </div>
  )
}
