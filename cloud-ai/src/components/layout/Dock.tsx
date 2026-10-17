/**
 * Translucent desktop dock. Mirrors the sidebar destinations, adds a new-chat
 * button, and keeps the window feeling like a real desktop application.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { NAV_ITEMS } from '../../lib/defaults'
import { navigate, useRoute } from '../../lib/router'
import { useAppStore } from '../../store/app'
import { useChatStore } from '../../store/chat'
import { cn } from '../../lib/utils'
import { iconFor } from '../common/icons'
import { requestStopGeneration } from '../../lib/useHotkeys'

export function Dock() {
  const route = useRoute()
  const streaming = useChatStore((state) => state.streaming)
  const startNew = useChatStore((state) => state.startNew)
  const units = useAppStore((state) => state.units)
  const [hovered, setHovered] = useState<string | null>(null)

  const dockItems = NAV_ITEMS.filter((item) => item.id !== 'history')

  return (
    <div className="pointer-events-none fixed bottom-3 left-0 right-0 z-40 flex justify-center px-4">
      <div className="glass-strong pointer-events-auto flex items-center gap-1 rounded-3xl px-2.5 py-2">
        <button
          type="button"
          onClick={() => {
            startNew({})
            navigate('/chat')
          }}
          title="New chat (Ctrl/Cmd + N)"
          className="mr-1 flex h-10 w-10 items-center justify-center rounded-2xl aurora-surface text-white shadow-lift transition active:scale-95"
        >
          <Plus size={18} />
        </button>

        {dockItems.map((item) => {
          const Icon = iconFor(item.icon)
          const active = item.path === '/' ? route.path === '/' : route.path.startsWith(item.path)
          return (
            <div key={item.id} className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() => navigate(item.path)}
                onMouseEnter={() => setHovered(item.id)}
                onMouseLeave={() => setHovered(null)}
                aria-label={item.label}
                className={cn(
                  'relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200 focus-ring',
                  active
                    ? 'bg-white/80 text-ink shadow-sm dark:bg-white/20'
                    : 'text-ink-soft hover:bg-white/55 hover:text-ink dark:hover:bg-white/10',
                )}
              >
                <Icon size={18} />
                {active && (
                  <motion.span
                    layoutId="dock-active"
                    className="absolute -bottom-1 h-1 w-1 rounded-full bg-[color:var(--aurora-blue)]"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  />
                )}
              </button>
              {hovered === item.id && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-strong absolute -top-9 whitespace-nowrap rounded-xl px-2.5 py-1 text-[11.5px] font-medium text-ink"
                >
                  {item.label}
                </motion.span>
              )}
            </div>
          )
        })}

        <div className="mx-1 h-7 w-px bg-white/50 dark:bg-white/15" />

        {streaming ? (
          <button
            type="button"
            onClick={requestStopGeneration}
            className="rounded-2xl border border-rose-300/60 bg-rose-500/90 px-3 py-2 text-[12.5px] font-medium text-white transition hover:bg-rose-500"
            title="Stop generating (Ctrl/Cmd + Shift + S)"
          >
            Stop
          </button>
        ) : (
          <span
            className="rounded-2xl border border-white/45 bg-white/40 px-3 py-2 text-[12px] text-ink-muted tabular-nums dark:border-white/10 dark:bg-white/5"
            title="Remaining AI units this month"
          >
            {units?.remaining ?? '–'} units
          </span>
        )}
      </div>
    </div>
  )
}
