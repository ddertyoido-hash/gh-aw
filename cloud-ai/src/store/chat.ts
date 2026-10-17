/**
 * Chat engine.
 *
 * Owns the message list, the streaming connection and the recovery paths
 * (retry, stop, regenerate, edit and resend, tool confirmation). Every page
 * that talks to a model - Home, Chat, Create, Research, Voice and agents -
 * drives this store, so behaviour is identical everywhere.
 */
import { create } from 'zustand'
import { api, ApiFailure, type ApiErrorShape, type ChatMessageRow } from '../lib/api'
import { useAppStore } from './app'

export type ChatMode = 'chat' | 'summarize' | 'research' | 'create'

export interface ClientMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string | null
  attachments: string[]
  error?: string | null
  streaming?: boolean
  created_at: string
  units?: number
}

export interface SendPayload {
  content: string
  attachments?: string[]
  agentId?: string | null
  mode?: ChatMode
  provider: string
  model: string
  conversationId?: string | null
  reuseUserMessageId?: string | null
  approvedTools?: string[]
}

interface ChatState {
  conversationId: string | null
  title: string
  messages: ClientMessage[]
  streaming: boolean
  loading: boolean
  error: ApiErrorShape | null
  pendingTool: { tool: string; urls: string[] } | null
  lastPayload: SendPayload | null
  agentId: string | null
  mode: ChatMode

  startNew: (options?: { agentId?: string | null; mode?: ChatMode; title?: string }) => void
  openConversation: (id: string) => Promise<void>
  send: (payload: SendPayload) => Promise<void>
  retry: () => Promise<void>
  approveTool: () => Promise<void>
  declineTool: () => void
  stop: () => void
  regenerate: (messageId: string, provider: string, model: string) => Promise<void>
  editAndResend: (messageId: string, content: string, provider: string, model: string) => Promise<void>
  clearError: () => void
  setMode: (mode: ChatMode) => void
  setTitle: (title: string) => void
}

let activeController: AbortController | null = null

const localId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const toClient = (row: ChatMessageRow): ClientMessage => ({
  id: row.id,
  role: row.role,
  content: row.content,
  model: row.model,
  attachments: row.attachments ?? [],
  error: row.error,
  created_at: row.created_at,
  units: row.units,
})

export const useChatStore = create<ChatState>()((set, get) => ({
  conversationId: null,
  title: 'New chat',
  messages: [],
  streaming: false,
  loading: false,
  error: null,
  pendingTool: null,
  lastPayload: null,
  agentId: null,
  mode: 'chat',

  startNew(options) {
    activeController?.abort()
    activeController = null
    set({
      conversationId: null,
      title: options?.title ?? 'New chat',
      messages: [],
      streaming: false,
      loading: false,
      error: null,
      pendingTool: null,
      lastPayload: null,
      agentId: options?.agentId ?? null,
      mode: options?.mode ?? 'chat',
    })
  },

  async openConversation(id) {
    activeController?.abort()
    activeController = null
    set({ loading: true, error: null })
    try {
      const { conversation, messages } = await api.conversation(id)
      set({
        conversationId: conversation.id,
        title: conversation.title,
        agentId: conversation.agent_id,
        mode: (conversation.kind as ChatMode) ?? 'chat',
        messages: messages.map(toClient),
        loading: false,
        streaming: false,
        pendingTool: null,
        lastPayload: null,
      })
    } catch (error) {
      set({
        loading: false,
        error: asError(error),
      })
    }
  },

  async send(payload) {
    const app = useAppStore.getState()
    const isReuse = Boolean(payload.reuseUserMessageId)
    set({
      streaming: true,
      error: null,
      pendingTool: null,
      lastPayload: payload,
      agentId: payload.agentId ?? get().agentId,
      mode: payload.mode ?? get().mode,
    })

    let optimisticId: string | null = null
    if (!isReuse) {
      optimisticId = localId('local-user')
      set({
        messages: [
          ...get().messages,
          {
            id: optimisticId,
            role: 'user',
            content: payload.content,
            attachments: payload.attachments ?? [],
            created_at: new Date().toISOString(),
          },
        ],
      })
    }

    const controller = new AbortController()
    activeController = controller
    let serverUserMessageId: string | null = payload.reuseUserMessageId ?? null
    let assistantId: string | null = null

    try {
      await api.streamChat(
        {
          conversationId: payload.conversationId ?? get().conversationId ?? undefined,
          agentId: payload.agentId ?? get().agentId ?? undefined,
          provider: payload.provider,
          model: payload.model,
          content: payload.content,
          attachments: payload.attachments ?? [],
          mode: payload.mode ?? get().mode,
          reuseUserMessageId: payload.reuseUserMessageId ?? undefined,
          approvedTools: payload.approvedTools ?? [],
        },
        {
          onEvent: (event, data) => {
            if (event === 'meta') {
              serverUserMessageId = data.userMessageId as string
              assistantId = data.assistantMessageId as string
              // The server assigned the real ids: adopt them so reloading the
              // conversation shows exactly the same turns.
              const messages = get().messages.map((message) =>
                message.id === optimisticId ? { ...message, id: data.userMessageId as string } : message,
              )
              optimisticId = null
              set({
                conversationId: data.conversationId as string,
                title: get().title === 'New chat' ? (data.title as string) : get().title,
                messages: [
                  ...messages,
                  {
                    id: data.assistantMessageId as string,
                    role: 'assistant',
                    content: '',
                    model: data.model as string,
                    attachments: [],
                    streaming: true,
                    created_at: new Date().toISOString(),
                  },
                ],
              })
            } else if (event === 'delta') {
              set({
                messages: get().messages.map((message) =>
                  message.id === assistantId ? { ...message, content: message.content + (data.text as string) } : message,
                ),
              })
            } else if (event === 'usage') {
              void useAppStore.getState().refreshUnits()
            } else if (event === 'done') {
              set({
                conversationId: data.conversationId as string,
                title: (data.title as string) ?? get().title,
                messages: get().messages.map((message) =>
                  message.id === assistantId ? { ...message, streaming: false } : message,
                ),
                streaming: false,
              })
              void useAppStore.getState().refreshActivity()
            } else if (event === 'error') {
              const failure = data as ApiErrorShape
              set({
                streaming: false,
                error: failure,
                messages: get().messages.map((message) =>
                  message.id === assistantId
                    ? { ...message, streaming: false, error: failure.message }
                    : message,
                ),
              })
            }
          },
        },
        controller.signal,
      )
    } catch (error) {
      const failure = asError(error)

      // Nothing reached the server, or the stream never opened: drop the
      // optimistic bubble so the UI never shows an unsaved message.
      if (optimisticId) {
        set({ messages: get().messages.filter((message) => message.id !== optimisticId) })
      }

      if (failure.code === 'tool_confirmation_required') {
        try {
          const parsed = JSON.parse(failure.hint ?? '{}') as { tool?: string; urls?: string[] }
          set({
            streaming: false,
            pendingTool: { tool: parsed.tool ?? 'web', urls: parsed.urls ?? [] },
            lastPayload: payload,
          })
          return
        } catch {
          // fall through to the plain error path
        }
      }

      // If the turn was already saved, keep it and retry against the same row.
      set({
        streaming: false,
        error: failure,
        lastPayload: serverUserMessageId && !isReuse
          ? { ...payload, reuseUserMessageId: serverUserMessageId, attachments: payload.attachments }
          : payload,
      })
      if (failure.needsUpgrade) {
        useAppStore.getState().pushToast({ tone: 'error', title: 'Not enough AI units', description: failure.hint })
      }
    } finally {
      activeController = null
      void app.refreshUnits()
    }
  },

  async retry() {
    const payload = get().lastPayload
    if (!payload) return
    await get().send(payload)
  },

  async approveTool() {
    const payload = get().lastPayload
    if (!payload) return
    const tool = get().pendingTool?.tool ?? 'web'
    set({ pendingTool: null })
    await get().send({ ...payload, approvedTools: [...(payload.approvedTools ?? []), tool] })
    void useAppStore.getState().refreshActivity()
  },

  declineTool() {
    const payload = get().lastPayload
    set({ pendingTool: null })
    if (payload) {
      useAppStore.getState().pushToast({
        tone: 'info',
        title: 'Page read cancelled',
        description: 'The agent answered without reading the link.',
      })
    }
  },

  stop() {
    activeController?.abort()
    activeController = null
    set({
      streaming: false,
      messages: get().messages.map((message) => (message.streaming ? { ...message, streaming: false } : message)),
    })
    void useAppStore.getState().refreshUnits()
  },

  async regenerate(messageId, provider, model) {
    const message = get().messages.find((candidate) => candidate.id === messageId)
    if (!message) return
    set({
      messages: get().messages.filter((candidate) => candidate.created_at <= message.created_at),
    })
    await get().send({
      content: message.content,
      attachments: message.attachments,
      provider,
      model,
      agentId: get().agentId,
      mode: get().mode,
      conversationId: get().conversationId,
      reuseUserMessageId: message.id,
    })
  },

  async editAndResend(messageId, content, provider, model) {
    const target = get().messages.find((message) => message.id === messageId)
    if (!target) return
    try {
      const result = await api.editMessage(messageId, content)
      // The server removed everything after the edited message, so mirror that
      // locally before streaming the new reply.
      set({
        messages: [
          ...get().messages.filter((message) => message.created_at <= target.created_at),
          { ...target, content, error: null },
        ],
      })
      await get().send({
        content,
        attachments: target.attachments,
        provider,
        model,
        agentId: get().agentId,
        mode: get().mode,
        conversationId: result.conversationId,
        reuseUserMessageId: messageId,
      })
    } catch (error) {
      set({ error: asError(error) })
    }
  },

  clearError() {
    set({ error: null, messages: get().messages.map((message) => ({ ...message, error: null })) })
  },

  setMode(mode) {
    set({ mode })
  },

  setTitle(title) {
    set({ title })
  },
}))

function asError(error: unknown): ApiErrorShape {
  if (error instanceof ApiFailure) {
    return { code: error.code, message: error.message, hint: error.hint }
  }
  if (error instanceof Error) return { code: 'unexpected', message: error.message }
  return { code: 'unexpected', message: 'Something went wrong.' }
}
