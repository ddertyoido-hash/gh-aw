/**
 * The Cloud AI prompt composer.
 *
 * Multiline input with Enter to send and Shift+Enter for a new line, file and
 * image attachments (native picker in the desktop app, drag and drop
 * everywhere), a server-backed microphone button, the model selector, and a
 * send button with an animated aurora gradient that becomes a stop button while
 * a response is streaming.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUp,
  Image as ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Send,
  Square,
  Telescope,
  Wand2,
  X,
} from 'lucide-react'
import { api, ApiFailure, type ChatAttachment } from '../../lib/api'
import { pickFiles } from '../../lib/desktop'
import { onFocusComposer } from '../../lib/useHotkeys'
import { useVoiceInput } from '../../lib/useVoice'
import { useAppStore } from '../../store/app'
import type { ChatMode } from '../../store/chat'
import { cn, estimateTokens, formatBytes } from '../../lib/utils'
import { Chip, IconButton, Segmented, Spinner } from '../common/Controls'
import { ModelSelector } from './ModelSelector'

interface PromptComposerProps {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (payload: { content: string; attachments: string[]; mode: ChatMode }) => void
  mode?: ChatMode
  onModeChange?: (mode: ChatMode) => void
  agent?: { id: string; name: string; color: string } | null
  onClearAgent?: () => void
  streaming?: boolean
  onStop?: () => void
  variant?: 'hero' | 'inline'
  autoFocus?: boolean
  placeholder?: string
  disabled?: boolean
  /** Restrict the model list, for example to vision models in the image studio. */
  requireCapabilities?: Array<'text' | 'vision' | 'image'>
}

const MODE_OPTIONS: Array<{ value: ChatMode; label: string; icon: ReactNode }> = [
  { value: 'chat', label: 'Chat', icon: <Send size={13} /> },
  { value: 'create', label: 'Write', icon: <Wand2 size={13} /> },
  { value: 'summarize', label: 'Summarize', icon: <Paperclip size={13} /> },
  { value: 'research', label: 'Research', icon: <Telescope size={13} /> },
]

export function PromptComposer({
  value,
  onValueChange,
  onSubmit,
  mode = 'chat',
  onModeChange,
  agent,
  onClearAgent,
  streaming = false,
  onStop,
  variant = 'hero',
  autoFocus = false,
  placeholder = 'Ask Cloud anything...',
  disabled = false,
  requireCapabilities = ['text'],
}: PromptComposerProps) {
  const providers = useAppStore((state) => state.providers)
  const unitCosts = useAppStore((state) => state.unitCosts)
  const settings = useAppStore((state) => state.settings)
  const pushToast = useAppStore((state) => state.pushToast)
  const addFile = useAppStore((state) => state.addFile)

  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const voice = useVoiceInput((finalText) => {
    onValueChange(`${value}${value && !value.endsWith(' ') ? ' ' : ''}${finalText}`.trimStart())
  })

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  useEffect(() => onFocusComposer(() => textareaRef.current?.focus()), [])

  // Grow with the content, up to a comfortable ceiling.
  useEffect(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    const max = variant === 'hero' ? 220 : 180
    node.style.height = `${Math.min(node.scrollHeight, max)}px`
  }, [value, variant])

  const handleFiles = useCallback(
    async (incoming: File[]) => {
      if (!settings.privacy.sendAttachments) {
        pushToast({
          tone: 'info',
          title: 'Attachments are disabled',
          description: 'Turn on "Send attachments to the model" in Settings, Privacy to attach files.',
        })
        return
      }
      const usable = incoming.filter((file) => file.size <= 25 * 1024 * 1024)
      if (usable.length !== incoming.length) {
        pushToast({ tone: 'error', title: 'Some files were skipped', description: 'Attachments must be 25 MB or smaller.' })
      }
      if (usable.length === 0) return
      setUploading(true)
      try {
        const result = await api.uploadFiles(usable)
        for (const file of result.files) addFile(file)
        setAttachments((current) => [...current, ...result.files])
      } catch (error) {
        pushToast({
          tone: 'error',
          title: 'Upload failed',
          description: error instanceof ApiFailure ? error.message : undefined,
        })
      } finally {
        setUploading(false)
      }
    },
    [addFile, pushToast, settings.privacy.sendAttachments],
  )

  const openPicker = async (mimePrefix?: string) => {
    const picked = await pickFiles()
    if (picked.length === 0) return
    const usable = mimePrefix ? picked.filter((file) => file.type.startsWith(mimePrefix)) : picked
    if (usable.length === 0) {
      pushToast({
        tone: 'info',
        title: 'No matching files',
        description: mimePrefix === 'image/' ? 'That picker only accepts images.' : undefined,
      })
      return
    }
    await handleFiles(usable)
  }

  const submit = () => {
    if (streaming || disabled) return
    const trimmed = value.trim()
    if (!trimmed && attachments.length === 0) return
    onSubmit({ content: trimmed, attachments: attachments.map((file) => file.id), mode })
    setAttachments([])
  }

  const cost =
    mode === 'research' ? unitCosts.research : mode === 'summarize' ? unitCosts.summarize : unitCosts.chat
  const units = useAppStore((state) => state.units)
  const tokens = estimateTokens(value)

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (event) => {
        event.preventDefault()
        setDragging(false)
        const dropped = Array.from(event.dataTransfer.files ?? [])
        if (dropped.length > 0) await handleFiles(dropped)
      }}
      className={cn(
        'relative w-full transition-all duration-300',
        variant === 'hero' ? 'max-w-3xl' : 'max-w-none',
      )}
    >
      <motion.div
        layout
        className={cn(
          'glass-strong relative rounded-3xl transition-all duration-300',
          variant === 'hero' ? 'p-3.5' : 'p-3',
          (focused || dragging) && 'shadow-glow',
          dragging && 'ring-2 ring-[color:var(--aurora-blue)] ring-offset-2 ring-offset-transparent',
        )}
      >
        {variant === 'hero' && onModeChange && (
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <Segmented value={mode} options={MODE_OPTIONS} onChange={onModeChange} size="sm" />
            {agent && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/55 px-2.5 py-1 text-[12px] font-medium text-ink-soft dark:border-white/15 dark:bg-white/10">
                <span className="h-2 w-2 rounded-full" style={{ background: agent.color }} />
                {agent.name}
                {onClearAgent && (
                  <button type="button" onClick={onClearAgent} aria-label="Leave agent session" className="ml-0.5 text-ink-muted hover:text-ink">
                    <X size={12} />
                  </button>
                )}
              </span>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {(attachments.length > 0 || uploading) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2 flex flex-wrap items-center gap-1.5"
            >
              {attachments.map((file) => (
                <Chip
                  key={file.id}
                  icon={<Paperclip size={12} />}
                  onRemove={() => setAttachments((current) => current.filter((item) => item.id !== file.id))}
                >
                  {file.name} · {formatBytes(file.size)}
                </Chip>
              ))}
              {uploading && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                  <Spinner size={12} />
                  Uploading
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder={voice.listening ? 'Listening…' : placeholder}
          aria-label="Message Cloud AI"
          className={cn(
            'w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none',
            variant === 'hero' ? 'min-h-[54px] px-1.5 py-1' : 'min-h-[44px] px-1.5 py-1',
          )}
        />

        {voice.listening && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/50 bg-white/50 px-3 py-1.5 text-[12.5px] text-ink-soft dark:border-white/15 dark:bg-white/10">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-rose-500/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
            {voice.interim || 'Listening through your microphone…'}
          </div>
        )}

        {voice.error && (
          <div className="mb-2 rounded-xl border border-amber-300/60 bg-amber-50/70 px-3 py-1.5 text-[12px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
            {voice.error}
          </div>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-0.5">
            <IconButton label="Attach a file" size="sm" onClick={() => void openPicker()} disabled={uploading}>
              <Paperclip size={16} />
            </IconButton>
            <IconButton label="Attach an image" size="sm" onClick={() => void openPicker('image/*')} disabled={uploading}>
              <ImageIcon size={16} />
            </IconButton>
            {voice.supported && (
              <IconButton
                label={voice.listening ? 'Stop listening' : 'Dictate with your voice'}
                size="sm"
                active={voice.listening}
                onClick={() => {
                  if (voice.listening) voice.stop()
                  else voice.start()
                }}
              >
                {voice.listening ? <MicOff size={16} /> : <Mic size={16} />}
              </IconButton>
            )}
            <span className="mx-1 hidden h-5 w-px bg-white/50 sm:block dark:bg-white/15" />
            <ModelSelector providers={providers} require={requireCapabilities} />
          </div>

          <div className="flex items-center gap-2">
            {units && (
              <span className="hidden text-[11.5px] text-ink-muted sm:inline" title="Units this action will use">
                {cost ?? 1} unit{cost && cost > 1 ? 's' : ''}
                {tokens > 24 && ` · ~${tokens} tokens`}
              </span>
            )}
            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-300/60 bg-rose-500/90 px-4 text-[13.5px] font-medium text-white transition hover:bg-rose-500"
              >
                <Square size={14} />
                Stop
              </button>
            ) : (
              <motion.button
                type="button"
                onClick={submit}
                disabled={disabled || (!value.trim() && attachments.length === 0)}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  'relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-2xl px-4 text-[13.5px] font-medium text-white transition',
                  'aurora-surface animate-shimmer shadow-lift disabled:cursor-not-allowed disabled:opacity-55',
                )}
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={15} />}
                Send
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {variant === 'hero' && (
        <div className="mt-2 flex items-center justify-between px-1.5 text-[11.5px] text-ink-muted">
          <span>
            Press <kbd className="rounded border border-white/50 bg-white/50 px-1 dark:border-white/15 dark:bg-white/10">Enter</kbd> to
            send · <kbd className="rounded border border-white/50 bg-white/50 px-1 dark:border-white/15 dark:bg-white/10">Shift</kbd> +{' '}
            <kbd className="rounded border border-white/50 bg-white/50 px-1 dark:border-white/15 dark:bg-white/10">Enter</kbd> for a new line
          </span>
          <span className="hidden sm:inline">Drop files straight onto the composer</span>
        </div>
      )}
    </div>
  )
}

/** Shared upload helper used by the image studio and settings screens. */
export async function uploadToLibrary(files: File[]): Promise<ChatAttachment[]> {
  const result = await api.uploadFiles(files)
  return result.files
}
