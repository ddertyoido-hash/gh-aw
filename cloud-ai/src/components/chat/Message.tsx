/**
 * One conversation turn.
 *
 * The layout stays conversational: your messages are compact bubbles on the
 * right, answers flow as plain text with a small avatar and a hover toolbar
 * (copy, read aloud, regenerate, edit). No oversized cards around every reply.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Pencil, RefreshCw, Volume2, VolumeX } from 'lucide-react'
import type { ClientMessage } from '../../store/chat'
import { useAppStore } from '../../store/app'
import { cn, copyText, formatTime } from '../../lib/utils'
import { CloudLogo } from '../brand/Logo'
import { IconButton, Spinner } from '../common/Controls'
import { MarkdownView } from '../common/MarkdownView'

interface MessageProps {
  message: ClientMessage
  providerLabel?: string
  onRegenerate?: () => void
  onEdit?: (content: string) => void
  onSpeak?: (content: string) => void
  speaking?: boolean
  busy?: boolean
  showActions?: boolean
}

export function Message({
  message,
  providerLabel,
  onRegenerate,
  onEdit,
  onSpeak,
  speaking = false,
  busy = false,
  showActions = true,
}: MessageProps) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const files = useAppStore((state) => state.files)
  const attachments = files.filter((file) => message.attachments.includes(file.id))

  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className={cn('group flex w-full gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      <div className="mt-0.5 shrink-0">
        {isUser ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/50 bg-white/70 text-[11.5px] font-semibold text-ink-soft dark:border-white/15 dark:bg-white/10">
            You
          </span>
        ) : (
          <CloudLogo size={32} />
        )}
      </div>

      <div className={cn('min-w-0 max-w-[min(760px,88%)]', isUser ? 'items-end text-right' : 'items-start')}>
        {attachments.length > 0 && (
          <div className={cn('mb-1.5 flex flex-wrap gap-1.5', isUser && 'justify-end')}>
            {attachments.map((file) =>
              file.mime.startsWith('image/') ? (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="overflow-hidden rounded-2xl border border-white/50 shadow-sm"
                >
                  <img src={file.url} alt={file.name} className="h-24 w-24 object-cover" />
                </a>
              ) : (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/50 bg-white/60 px-2.5 py-1 text-[12px] text-ink-soft transition hover:bg-white/80 dark:border-white/15 dark:bg-white/10"
                >
                  {file.name}
                </a>
              ),
            )}
          </div>
        )}

        {editing ? (
          <div className="w-full text-left">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={Math.min(10, Math.max(3, draft.split('\n').length))}
              className="w-full rounded-2xl border border-white/55 bg-white/75 p-3 text-[14px] leading-relaxed text-ink outline-none focus:shadow-glow dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-100"
              aria-label="Edit your message"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => {
                  setEditing(false)
                  onEdit?.(draft.trim())
                }}
                className="rounded-xl aurora-surface px-3 py-1.5 text-[12.5px] font-medium text-white shadow-lift disabled:opacity-55"
              >
                Save and resend
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setDraft(message.content)
                }}
                className="rounded-xl px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition hover:bg-white/60 dark:hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'inline-block max-w-full text-left',
              isUser
                ? 'rounded-2xl rounded-tr-md border border-white/55 bg-white/70 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink shadow-sm dark:border-white/15 dark:bg-white/12 dark:text-slate-100'
                : 'px-0.5 py-1',
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : message.content ? (
              <MarkdownView content={message.content} className={cn('markdown', message.streaming && 'streaming-caret')} />
            ) : message.streaming ? (
              <span className="inline-flex items-center gap-2 text-[13.5px] text-ink-muted">
                <Spinner size={14} />
                Cloud AI is thinking…
              </span>
            ) : null}
          </div>
        )}

        {message.error && (
          <div className="mt-1.5 rounded-xl border border-rose-300/60 bg-rose-50/80 px-2.5 py-1.5 text-[12px] text-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
            {message.error}
          </div>
        )}

        <div className={cn('mt-1 flex items-center gap-2 px-0.5 text-[11.5px] text-ink-muted', isUser && 'justify-end')}>
          <span>{formatTime(message.created_at)}</span>
          {!isUser && message.model && <span>· {message.model}</span>}
          {!isUser && providerLabel && !message.streaming && <span>· {providerLabel}</span>}
        </div>

        {showActions && !message.streaming && (
          <div
            className={cn(
              'mt-1 flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100',
              isUser && 'justify-end',
            )}
          >
            <IconButton
              label={copied ? 'Copied' : 'Copy message'}
              size="sm"
              onClick={async () => {
                const ok = await copyText(message.content)
                if (ok) {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1600)
                }
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </IconButton>
            {!isUser && onSpeak && (
              <IconButton label={speaking ? 'Stop reading' : 'Read aloud'} size="sm" onClick={() => onSpeak(message.content)}>
                {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </IconButton>
            )}
            {!isUser && onRegenerate && (
              <IconButton label="Regenerate response" size="sm" onClick={onRegenerate} disabled={busy}>
                <RefreshCw size={14} />
              </IconButton>
            )}
            {isUser && onEdit && (
              <IconButton label="Edit and resend" size="sm" onClick={() => setEditing(true)} disabled={busy}>
                <Pencil size={14} />
              </IconButton>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
