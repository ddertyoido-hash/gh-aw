/**
 * Toast stack. Toasts report the outcome of actions (saved, copied, failed)
 * without blocking the workspace.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useAppStore } from '../../store/app'
import { cn } from '../../lib/utils'

export function Toasts() {
  const toasts = useAppStore((state) => state.toasts)
  const dismiss = useAppStore((state) => state.dismissToast)

  return (
    <div className="pointer-events-none fixed bottom-24 right-6 z-[60] flex w-[min(360px,calc(100vw-3rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={cn(
              'glass-strong pointer-events-auto flex items-start gap-3 rounded-2xl px-3.5 py-3',
              toast.tone === 'error' && 'border-rose-300/60',
            )}
          >
            <span
              className={cn(
                'mt-0.5 shrink-0',
                toast.tone === 'error' ? 'text-rose-500' : toast.tone === 'success' ? 'text-emerald-500' : 'text-[color:var(--aurora-blue)]',
              )}
            >
              {toast.tone === 'error' ? (
                <AlertCircle size={17} />
              ) : toast.tone === 'success' ? (
                <CheckCircle2 size={17} />
              ) : (
                <Info size={17} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium text-ink">{toast.title}</div>
              {toast.description && (
                <div className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{toast.description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-lg p-1 text-ink-muted transition hover:bg-white/60 hover:text-ink dark:hover:bg-white/10"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
