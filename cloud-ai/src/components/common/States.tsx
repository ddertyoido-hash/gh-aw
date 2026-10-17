/**
 * Shared state surfaces: loading screen, empty states, error banners and the
 * provider setup screen shown when no AI credentials exist yet.
 */
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowUpRight, KeyRound, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button, Spinner } from './Controls'
import { CloudLogo } from '../brand/Logo'

export function LoadingScreen({ label = 'Waking up Cloud AI' }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative"
      >
        <div className="absolute -inset-6 rounded-[38px] bg-white/25 blur-2xl" />
        <CloudLogo size={76} className="relative animate-float drop-shadow-xl" />
      </motion.div>
      <div className="text-center">
        <div className="text-base font-semibold tracking-tight text-ink">Cloud AI</div>
        <div className="mt-1 flex items-center justify-center gap-2 text-[13px] text-ink-muted">
          <Spinner size={13} />
          {label}
        </div>
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/50 bg-white/55 text-[color:var(--aurora-blue)] dark:border-white/15 dark:bg-white/10">
          {icon}
        </div>
      )}
      <div>
        <div className="text-sm font-semibold text-ink">{title}</div>
        {description && <div className="mx-auto mt-1 max-w-sm text-[13px] leading-snug text-ink-muted">{description}</div>}
      </div>
      {action}
    </div>
  )
}

export function ErrorBanner({
  message,
  hint,
  onRetry,
  onDismiss,
  retryLabel = 'Try again',
  className,
}: {
  message: string
  hint?: string
  onRetry?: () => void
  onDismiss?: () => void
  retryLabel?: string
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-2xl border border-rose-300/60 bg-rose-50/80 px-3.5 py-3 text-rose-900 backdrop-blur-md dark:bg-rose-950/40 dark:text-rose-100',
        className,
      )}
      role="alert"
    >
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">{message}</div>
        {hint && <div className="mt-1 text-[12.5px] leading-snug opacity-90">{hint}</div>}
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button size="sm" variant="soft" icon={<RefreshCw size={14} />} onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
        {onDismiss && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </motion.div>
  )
}

/**
 * Shown when no provider is configured. It never fakes a model: it explains
 * exactly which environment variable is missing and how to get a key.
 */
export function ProviderSetupScreen({
  providers,
  onOpenSettings,
}: {
  providers: Array<{ id: string; label: string; configured: boolean; envKeys: string[]; docsUrl: string; setupHint: string }>
  onOpenSettings: () => void
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="glass-strong rounded-3xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl aurora-surface text-white shadow-lift">
            <KeyRound size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Connect an AI provider to start</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
              Cloud AI talks directly to official model APIs. Credentials live in the server environment or, in the
              desktop app, in your operating system's credential store - they are never written into the interface,
              browser storage or logs. Until a key is present, no model is contacted and no response is invented.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/50 bg-white/45 px-4 py-3 dark:border-white/10 dark:bg-white/5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{provider.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      provider.configured
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                        : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
                    )}
                  >
                    {provider.configured ? 'Connected' : 'Not configured'}
                  </span>
                </div>
                <div className="mt-1 text-[12.5px] text-ink-muted">
                  {provider.envKeys.length > 0 ? (
                    <code className="rounded bg-slate-900/8 px-1.5 py-0.5 font-mono text-[11.5px] dark:bg-white/10">
                      {provider.envKeys.join(' · ')}
                    </code>
                  ) : (
                    'No key needed - point it at a local endpoint in Settings.'
                  )}
                </div>
              </div>
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[13px] font-medium text-[color:var(--aurora-blue)] transition hover:bg-white/60 dark:hover:bg-white/10"
              >
                Get a key
                <ArrowUpRight size={14} />
              </a>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={<Sparkles size={16} />} onClick={onOpenSettings}>
            Open provider settings
          </Button>
          <span className="text-[12.5px] text-ink-muted">
            Or run a local model with Ollama and set the base URL to http://127.0.0.1:11434/v1
          </span>
        </div>
      </div>
    </div>
  )
}
