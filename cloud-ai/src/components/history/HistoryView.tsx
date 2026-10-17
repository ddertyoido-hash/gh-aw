/**
 * History: every conversation, research session and generated image, with
 * search, rename, pin, delete and a full local data export.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Image as ImageIcon, MessageSquare, Pencil, Pin, PinOff, Search, Telescope, Trash2 } from 'lucide-react'
import { api, ApiFailure, type Conversation, type GeneratedImage } from '../../lib/api'
import { navigate } from '../../lib/router'
import { useAppStore } from '../../store/app'
import { cn, formatRelative, truncate } from '../../lib/utils'
import { Button, IconButton, Input, Segmented } from '../common/Controls'
import { EmptyState } from '../common/States'
import { Modal } from '../common/Modal'

type HistoryTab = 'chat' | 'research' | 'images'

export function HistoryView() {
  const pushToast = useAppStore((state) => state.pushToast)
  const refreshActivity = useAppStore((state) => state.refreshActivity)
  const [tab, setTab] = useState<HistoryTab>('chat')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [renaming, setRenaming] = useState<Conversation | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<Conversation | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [conversationList, imageList] = await Promise.all([api.conversations(), api.images()])
      setConversations(conversationList.conversations)
      setImages(imageList.images)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'History could not be loaded',
        description: error instanceof ApiFailure ? error.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return conversations
      .filter((conversation) => {
        const matchesTab =
          tab === 'images'
            ? false
            : tab === 'research'
              ? conversation.kind === 'research'
              : conversation.kind === 'chat'
        if (!matchesTab) return false
        if (!needle) return true
        return (
          conversation.title.toLowerCase().includes(needle) ||
          (conversation.preview ?? '').toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at))
  }, [conversations, query, tab])

  const filteredImages = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return images
    return images.filter((image) => image.prompt.toLowerCase().includes(needle))
  }, [images, query])

  const togglePin = async (conversation: Conversation) => {
    try {
      const result = await api.patchConversation(conversation.id, { pinned: !conversation.pinned })
      setConversations((current) =>
        current.map((candidate) => (candidate.id === conversation.id ? { ...candidate, ...result.conversation } : candidate)),
      )
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not update the conversation',
        description: error instanceof ApiFailure ? error.message : undefined,
      })
    }
  }

  const saveRename = async () => {
    if (!renaming) return
    const title = renameValue.trim()
    if (!title) return
    try {
      const result = await api.patchConversation(renaming.id, { title })
      setConversations((current) =>
        current.map((candidate) => (candidate.id === renaming.id ? { ...candidate, ...result.conversation } : candidate)),
      )
      pushToast({ tone: 'success', title: 'Conversation renamed' })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Rename failed',
        description: error instanceof ApiFailure ? error.message : undefined,
      })
    } finally {
      setRenaming(null)
    }
  }

  const remove = async () => {
    if (!deleting) return
    try {
      await api.deleteConversation(deleting.id)
      setConversations((current) => current.filter((candidate) => candidate.id !== deleting.id))
      void refreshActivity()
      pushToast({ tone: 'success', title: 'Conversation deleted' })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Delete failed',
        description: error instanceof ApiFailure ? error.message : undefined,
      })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 pb-28 pt-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">History</h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            Everything you have made with Cloud AI, stored on this machine.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="soft"
            icon={<Download size={15} />}
            onClick={() => {
              window.location.href = api.exportUrl()
              pushToast({ tone: 'success', title: 'Export started', description: 'A JSON file with your local data is downloading.' })
            }}
          >
            Export data
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'chat', label: 'Chats', icon: <MessageSquare size={13} /> },
            { value: 'research', label: 'Research', icon: <Telescope size={13} /> },
            { value: 'images', label: 'Images', icon: <ImageIcon size={13} /> },
          ]}
        />
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === 'images' ? 'Search prompts' : 'Search conversations'}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-8 text-center text-[13px] text-ink-muted">Loading your history…</div>
      ) : tab === 'images' ? (
        filteredImages.length === 0 ? (
          <div className="glass rounded-3xl">
            <EmptyState
              icon={<ImageIcon size={20} />}
              title="No images match"
              description="Generate something in the Image studio and it will show up here."
              action={
                <Button variant="soft" onClick={() => navigate('/images')}>
                  Open image studio
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {filteredImages.map((image) => (
              <motion.button
                key={image.id}
                type="button"
                whileHover={{ y: -3 }}
                onClick={() => navigate('/images')}
                className="group overflow-hidden rounded-3xl border border-white/50 bg-white/40 text-left shadow-sm transition hover:shadow-float dark:border-white/10 dark:bg-white/5"
              >
                <img src={image.url} alt={image.prompt} className="aspect-square w-full object-cover" loading="lazy" />
                <span className="block px-2.5 py-2">
                  <span className="line-clamp-2 text-[11.5px] text-ink-soft">{image.prompt}</span>
                  <span className="mt-0.5 block text-[10.5px] text-ink-muted">{formatRelative(image.created_at)}</span>
                </span>
              </motion.button>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="glass rounded-3xl">
          <EmptyState
            icon={tab === 'research' ? <Telescope size={20} /> : <MessageSquare size={20} />}
            title={tab === 'research' ? 'No research sessions yet' : 'No conversations yet'}
            description="Start a chat and it will be saved here automatically."
            action={
              <Button variant="soft" onClick={() => navigate(tab === 'research' ? '/research' : '/chat')}>
                {tab === 'research' ? 'Start researching' : 'Open chat'}
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((conversation) => (
            <li key={conversation.id}>
              <motion.div
                layout
                className={cn(
                  'glass group flex items-start gap-3 rounded-3xl p-3.5 transition hover:shadow-lift',
                  conversation.pinned && 'ring-1 ring-white/60 dark:ring-white/20',
                )}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/60 text-ink-soft dark:bg-white/10">
                  {conversation.kind === 'research' ? <Telescope size={16} /> : <MessageSquare size={16} />}
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/chat?c=${conversation.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-ink">{conversation.title}</span>
                    {conversation.pinned === 1 && <Pin size={12} className="shrink-0 text-[color:var(--aurora-blue)]" />}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-muted">
                    {truncate(conversation.preview ?? '', 120) || 'No messages yet'}
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-muted">
                    {conversation.messageCount ?? 0} messages · updated {formatRelative(conversation.updated_at)}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <IconButton
                    label={conversation.pinned ? 'Unpin' : 'Pin to top'}
                    size="sm"
                    onClick={() => void togglePin(conversation)}
                  >
                    {conversation.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </IconButton>
                  <IconButton
                    label="Rename"
                    size="sm"
                    onClick={() => {
                      setRenaming(conversation)
                      setRenameValue(conversation.title)
                    }}
                  >
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton
                    label="Delete conversation"
                    size="sm"
                    className="text-rose-500"
                    onClick={() => setDeleting(conversation)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </motion.div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title="Rename conversation"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void saveRename()} disabled={!renameValue.trim()}>
              Save
            </Button>
          </>
        }
      >
        <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus />
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this conversation?"
        description="The messages are removed from your local database. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => void remove()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-ink-soft">{deleting?.title}</p>
      </Modal>
    </div>
  )
}
