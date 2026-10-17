/**
 * Chat screen: conversation header plus the shared thread view (messages,
 * streaming and composer). Conversations are stored server-side so they survive
 * restarts and can be reopened from History.
 */
import { useEffect, useMemo } from 'react'
import { History, MessageSquarePlus } from 'lucide-react'
import { navigate, useRoute } from '../../lib/router'
import { useAppStore } from '../../store/app'
import { useChatStore } from '../../store/chat'
import { Button, IconButton } from '../common/Controls'
import { ThreadView } from './ThreadView'

const SUGGESTIONS = [
  'Summarize a long email thread into three bullet points',
  'Draft a polite follow-up to a client who went quiet',
  'Explain vector databases to a product manager',
  'Plan a 5-day trip to the Georgian mountains',
]

export function ChatView() {
  const route = useRoute()
  const settings = useAppStore((state) => state.settings)
  const providers = useAppStore((state) => state.providers)
  const agents = useAppStore((state) => state.agents)

  const conversationId = useChatStore((state) => state.conversationId)
  const title = useChatStore((state) => state.title)
  const messageCount = useChatStore((state) => state.messages.length)
  const agentId = useChatStore((state) => state.agentId)
  const startNew = useChatStore((state) => state.startNew)
  const openConversation = useChatStore((state) => state.openConversation)

  const agent = useMemo(() => agents.find((candidate) => candidate.id === agentId) ?? null, [agents, agentId])
  const providerLabel = useMemo(
    () => providers.find((provider) => provider.id === settings.defaultProvider)?.label,
    [providers, settings.defaultProvider],
  )

  const requestedConversation = route.query.get('c')
  useEffect(() => {
    if (requestedConversation) {
      if (requestedConversation !== conversationId) void openConversation(requestedConversation)
      return
    }
    if (!conversationId && messageCount === 0) startNew({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedConversation])

  useEffect(() => {
    const onNewChat = () => startNew({})
    window.addEventListener('cloud-ai:new-chat', onNewChat)
    return () => window.removeEventListener('cloud-ai:new-chat', onNewChat)
  }, [startNew])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/30 px-4 py-2.5 dark:border-white/10">
        <div className="min-w-0">
          <h1 className="truncate text-[14.5px] font-semibold tracking-tight text-ink">{title || 'New chat'}</h1>
          <p className="truncate text-[12px] text-ink-muted">
            {agent ? `${agent.name} session` : 'Cloud AI'} · {providerLabel ?? 'no provider connected'} ·{' '}
            {settings.defaultModel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="soft" icon={<MessageSquarePlus size={14} />} onClick={() => startNew({})}>
            New chat
          </Button>
          <IconButton label="Open conversation history" size="sm" onClick={() => navigate('/history')}>
            <History size={16} />
          </IconButton>
        </div>
      </div>

      <ThreadView suggestions={SUGGESTIONS} />
    </div>
  )
}
