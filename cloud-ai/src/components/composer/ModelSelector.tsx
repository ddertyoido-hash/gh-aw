/**
 * Model selector that lives inside the composer.
 *
 * It only lists models from providers that are actually configured, groups them
 * by provider, shows what each model can do (vision, image, reasoning tier) and
 * links straight to the settings when nothing is connected yet. The choice is
 * saved as a preference, so the app opens with the model you used last.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Cpu, Eye, Image as ImageIcon, Settings2, Zap } from 'lucide-react'
import type { ProviderModel } from '../../lib/api'
import { navigate } from '../../lib/router'
import { useAppStore } from '../../store/app'
import { cn } from '../../lib/utils'

interface ModelSelectorProps {
  providers: Array<{ id: string; label: string; configured: boolean; models: ProviderModel[] }>
  /** Restrict to models that can handle these capabilities. */
  require?: Array<'text' | 'vision' | 'image'>
  compact?: boolean
  align?: 'up' | 'down'
}

export function ModelSelector({ providers, require = ['text'], compact, align = 'up' }: ModelSelectorProps) {
  const settings = useAppStore((state) => state.settings)
  const saveSettings = useAppStore((state) => state.saveSettings)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const candidates = useMemo(
    () =>
      providers
        .filter((provider) => provider.configured)
        .map((provider) => ({
          ...provider,
          models: provider.models.filter((model) =>
            require.every((capability) => model.capabilities.includes(capability)),
          ),
        }))
        .filter((provider) => provider.models.length > 0),
    [providers, require],
  )

  const current = useMemo(() => {
    for (const provider of candidates) {
      const match = provider.models.find((model) => model.id === settings.defaultModel)
      if (match) return { provider, model: match }
    }
    const first = candidates[0]
    return first ? { provider: first, model: first.models[0] } : null
  }, [candidates, settings.defaultModel])

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (candidates.length === 0) {
    return (
      <button
        type="button"
        onClick={() => navigate('/settings?tab=providers')}
        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/70 bg-amber-100/70 px-2.5 py-1.5 text-[12.5px] font-medium text-amber-900 transition hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-100"
      >
        <Settings2 size={13} />
        No model connected
      </button>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex max-w-[230px] items-center gap-1.5 rounded-xl border border-white/55 bg-white/60 px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition hover:bg-white/80 focus-ring',
          'dark:border-white/15 dark:bg-white/10 dark:text-slate-200',
        )}
        title={current ? `${current.model.label} — ${current.model.description}` : 'Choose a model'}
      >
        <Cpu size={13} className="text-[color:var(--aurora-blue)]" />
        <span className="truncate">{current?.model.label ?? 'Choose model'}</span>
        {!compact && current && (
          <span className="hidden text-[11px] font-normal text-ink-muted sm:inline">{current.provider.label}</span>
        )}
        <ChevronDown size={13} className={cn('transition', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: align === 'up' ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: align === 'up' ? 4 : -4, scale: 0.985 }}
            transition={{ duration: 0.16 }}
            role="listbox"
            className={cn(
              'glass-strong absolute z-40 w-[330px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl p-1.5',
              align === 'up' ? 'bottom-[calc(100%+8px)] left-0' : 'top-[calc(100%+8px)] left-0',
            )}
          >
            <div className="max-h-[320px] overflow-y-auto">
              {candidates.map((provider) => (
                <div key={provider.id} className="mb-1 last:mb-0">
                  <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {provider.label}
                  </div>
                  {provider.models.map((model) => {
                    const active = model.id === settings.defaultModel
                    return (
                      <button
                        key={`${provider.id}-${model.id}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          void saveSettings({ defaultProvider: provider.id, defaultModel: model.id })
                          setOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition',
                          active ? 'bg-white/80 dark:bg-white/15' : 'hover:bg-white/55 dark:hover:bg-white/10',
                        )}
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/70 text-ink-soft dark:bg-white/10">
                          {active ? <Check size={13} /> : <ModelTierIcon tier={model.tier} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium text-ink">{model.label}</span>
                            {model.capabilities.includes('vision') && (
                              <Eye size={12} className="shrink-0 text-ink-muted" aria-label="Reads images" />
                            )}
                            {model.capabilities.includes('image') && (
                              <ImageIcon size={12} className="shrink-0 text-ink-muted" aria-label="Creates images" />
                            )}
                            {model.tier === 'powerful' && <Zap size={12} className="shrink-0 text-amber-500" />}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">{model.description}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate('/settings?tab=providers')
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-white/40 px-2.5 py-2 text-[12.5px] font-medium text-[color:var(--aurora-blue)] transition hover:bg-white/55 dark:border-white/10 dark:hover:bg-white/10"
            >
              <Settings2 size={13} />
              Manage providers and keys
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ModelTierIcon({ tier }: { tier: ProviderModel['tier'] }) {
  if (tier === 'image') return <ImageIcon size={12} />
  if (tier === 'powerful') return <Zap size={12} />
  return <Cpu size={12} />
}
