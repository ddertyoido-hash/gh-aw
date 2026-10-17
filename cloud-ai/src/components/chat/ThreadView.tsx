/**
 * Reusable conversation thread: message list, streaming indicators, message
 * actions, tool confirmation and the composer.
 *
 * Chat, Create, Research and Voice all render this, so a reply streams and
 * behaves identically wherever the conversation was started.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageSquarePlus, ShieldCheck } from 'lucide-react'
import { useAppStore } from '../../store/app'
import { useChatStore, type ChatMode } from '../../store/chat'
import { greeting } from '../../lib/utils'
import { onStopGeneration } from '../../lib/useHotkeys'
import { Button, Spinner } from '../common/Controls'
import { EmptyState, ErrorBanner } from '../common/States'
import { Modal } from '../common/Modal'
import { PromptComposer } from '../composer/PromptComposer'
import { Message } from './Message'
import { useSpeaker } from '../../lib/useVoice'

interface ThreadViewProps {
  /** Overrides the store mode for this surface. */
  mode?: ChatMode
  onModeChange?: (mode: ChatMode) => void
  agentId?: string | null
  placeholder?: string
  suggestions?: string[]
  emptyTitle?: string
  emptyDescription?: string
  /** Seed text for the composer (used by templates and quick actions). */
  prefill?: string | null
  /** Speak new answers automatically (used by the Voice screen). */
  speakReplies?: boolean
}

export function ThreadView({
  mode,
  onModeChange,
  agentId,
  placeholder,
  suggestions = [],
  emptyTitle,
  emptyDescription,
  prefill = null,
  speakReplies = false,
}: ThreadViewProps) {
  const settings = useAppStore((state) => state.settings)
  const providers = useAppStore((state) => state.providers)
  const agents = useAppStore((state) => state.agents)

  const messages = useChatStore((state) => state.messages)
  const streaming = useChatStore((state) => state.streaming)
  const error = useChatStore((state) => state.error)
  const pendingTool = useChatStore((state) => state.pendingTool)
  const storeMode = useChatStore((state) => state.mode)
  const storeAgentId = useChatStore((state) => state.agentId)
  const conversationId = useChatStore((state) => state.conversationId)

  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const speaker = useSpeaker()
  const speakingRef = useRef<string | null>(null)
  const lastSpokenRef = useRef<string | null>(null)

  const activeMode = mode ?? storeMode
  const activeAgentId = agentId !== undefined ? agentId : storeAgentId
  const agent = useMemo(() => agents.find((candidate) => candidate.id === activeAgentId) ?? null, [agents, activeAgentId])
  const providerLabel = useMemo(
    () => providers.find((provider) => provider.id === settings.defaultProvider)?.label,
    [providers, settings.defaultProvider],
  )

  useEffect(() => onStopGeneration(() => useChatStore.getState().stop()), [])

  // Hand the seeded text to the composer (templates, quick actions).
  useEffect(() => {
    if (prefill) setDraft(prefill)
  }, [prefill])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const onScroll = () => {
      stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 140
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!stickToBottom.current) return
    bottomRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth', block: 'end' })
  }, [messages, streaming])

  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')

  // Optional read-aloud for voice conversations.
  useEffect(() => {
    if (!speakReplies || !lastAssistant || lastAssistant.streaming) return
    if (!lastAssistant.content || lastSpokenRef.current === lastAssistant.id) return
    lastSpokenRef.current = lastAssistant.id
    speakingRef.current = lastAssistant.content
    void speaker.speak(lastAssistant.content)
  }, [lastAssistant, speakReplies, speaker])

  const handleSubmit = ({
    content,
    attachments,
    mode: submitMode,
  }: {
    content: string
    attachments: string[]
    mode: ChatMode
  }) => {
    setDraft('')
    stickToBottom.current = true
    void useChatStore.getState().send({
      content,
      attachments,
      mode: submitMode,
      provider: settings.defaultProvider,
      model: settings.defaultModel,
      agentId: activeAgentId,
      conversationId,
    })
  }

  const handleSpeak = useCallback(
    async (content: string) => {
      if (speakingRef.current === content) {
        speaker.cancel()
        speakingRef.current = null
        return
      }
      speakingRef.current = content
      await speaker.speak(content)
    },
    [speaker],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 pt-8">
            <EmptyState
              className="py-2"
              icon={<MessageSquarePlus size={20} />}
              title={emptyTitle ?? `${greeting()} — start a conversation`}
              description={emptyDescription ?? 'Ask anything, attach a file, or pick one of these to get moving.'}
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setDraft(suggestion)}
                    className="glass rounded-2xl px-3 py-2 text-left text-[12.5px] text-ink-soft transition hover:shadow-lift"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.map((message, index) => (
              <Message
                key={message.id}
                message={message}
                providerLabel={providerLabel}
                busy={streaming}
                speaking={speakingRef.current === message.content && speaker.speaking}
                onSpeak={message.role === 'assistant' ? (content) => void handleSpeak(content) : undefined}
                onRegenerate={
                  message.role === 'assistant' && index === messages.length - 1
                    ? () => {
                        const previousUser = [...messages].reverse().find((candidate) => candidate.role === 'user')
                        if (!previousUser) return
                        void useChatStore
                          .getState()
                          .regenerate(previousUser.id, settings.defaultProvider, settings.defaultModel)
                      }
                    : undefined
                }
                onEdit={
                  message.role === 'user'
                    ? (content) =>
                        void useChatStore
                          .getState()
                          .editAndResend(message.id, content, settings.defaultProvider, settings.defaultModel)
                    : undefined
                }
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-white/30 px-4 pb-24 pt-3 sm:px-6 dark:border-white/10">
        <div className="mx-auto max-w-3xl space-y-2.5">
          <AnimatePresence>
            {error && (
              <ErrorBanner
                message={error.message}
                hint={error.hint}
                onRetry={error.code === 'insufficient_units' ? undefined : () => void useChatStore.getState().retry()}
                onDismiss={() => useChatStore.getState().clearError()}
              />
            )}
          </AnimatePresence>

          {lastAssistant?.streaming && (
            <div className="flex items-center justify-between text-[12px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Spinner size={12} />
                Streaming response…
              </span>
              <button
                type="button"
                onClick={() => useChatStore.getState().stop()}
                className="font-medium text-[color:var(--aurora-blue)]"
              >
                Stop generating
              </button>
            </div>
          )}

          <PromptComposer
            variant="inline"
            value={draft}
            onValueChange={setDraft}
            onSubmit={handleSubmit}
            mode={activeMode}
            onModeChange={onModeChange}
            agent={agent ? { id: agent.id, name: agent.name, color: agent.color } : null}
            onClearAgent={agent ? () => useChatStore.getState().startNew({}) : undefined}
            streaming={streaming}
            onStop={() => useChatStore.getState().stop()}
            placeholder={placeholder}
          />
        </div>
      </div>

      <Modal
        open={Boolean(pendingTool)}
        onClose={() => useChatStore.getState().declineTool()}
        title="Allow this action?"
        description="Agents only run the tools you enabled, and consequential steps always ask first."
        footer={
          <>
            <Button variant="ghost" onClick={() => useChatStore.getState().declineTool()}>
              No, answer without it
            </Button>
            <Button
              variant="primary"
              icon={<ShieldCheck size={15} />}
              onClick={() => void useChatStore.getState().approveTool()}
            >
              Read the page and answer
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-[13.5px] text-ink-soft">
          <p>
            The <strong>{agent?.name ?? 'selected agent'}</strong> wants to fetch this page so the answer uses its
            content:
          </p>
          <ul className="space-y-1">
            {(pendingTool?.urls ?? []).map((url) => (
              <li key={url} className="truncate rounded-xl bg-white/60 px-3 py-2 font-mono text-[12px] dark:bg-white/10">
                {url}
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] text-ink-muted">
            Only the page text is read, it is sent to the model with your message, and nothing is stored beyond this
            conversation.
          </p>
        </div>
      </Modal>

      {speaker.speaking && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => {
            speaker.cancel()
            speakingRef.current = null
          }}
          className="glass-strong fixed bottom-24 left-6 z-40 flex items-center gap-2 rounded-2xl px-3 py-2 text-[12.5px] font-medium text-ink-soft"
        >
          <span className="flex items-end gap-0.5">
            {[0, 1, 2, 3].map((bar) => (
              <motion.span
                key={bar}
                className="w-0.5 rounded-full bg-[color:var(--aurora-blue)]"
                animate={{ height: [4, 12, 6, 14, 5] }}
                transition={{ duration: 1, repeat: Infinity, delay: bar * 0.12 }}
                style={{ height: 6 }}
              />
            ))}
          </span>
          Reading aloud · stop
        </motion.button>
      )}
    </div>
  )
}
