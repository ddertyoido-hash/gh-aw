/**
 * Left sidebar: branding, navigation, and the account card with plan and
 * remaining AI units. Collapses to an icon rail and becomes an overlay drawer
 * in narrow windows.
 */
import { motion } from 'framer-motion'
import { ChevronsLeft, ChevronsRight, Zap } from 'lucide-react'
import { NAV_ITEMS } from '../../lib/defaults'
import { navigate, useRoute } from '../../lib/router'
import { useAppStore } from '../../store/app'
import { cn } from '../../lib/utils'
import { CloudWordmark } from '../brand/Logo'
import { IconButton } from '../common/Controls'
import { iconFor } from '../common/icons'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  /** Drawer mode (narrow windows) closes the overlay after navigating. */
  onNavigate?: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  const route = useRoute()
  const settings = useAppStore((state) => state.settings)
  const units = useAppStore((state) => state.units)

  const profileName = (settings as unknown as { profileName?: string }).profileName ?? 'Local workspace'
  const initials = profileName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const unitPercent = units && units.granted > 0 ? Math.round((units.remaining / units.granted) * 100) : 0

  return (
    <motion.aside
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className={cn(
        'relative flex h-full shrink-0 flex-col border-r border-white/35 dark:border-white/10',
        collapsed ? 'w-[68px]' : 'w-[248px]',
      )}
    >
      <div className={cn('flex items-center px-3 pb-2 pt-3', collapsed ? 'justify-center' : 'justify-between')}>
        <button
          type="button"
          onClick={() => {
            navigate('/')
            onNavigate?.()
          }}
          className="rounded-2xl p-1 transition hover:bg-white/40 focus-ring dark:hover:bg-white/10"
          title="Cloud AI home"
        >
          <CloudWordmark size={30} compact={collapsed} />
        </button>
        {!collapsed && (
          <IconButton label="Collapse sidebar" onClick={onToggleCollapse} size="sm">
            <ChevronsLeft size={16} />
          </IconButton>
        )}
      </div>

      <nav className="mt-1 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {NAV_ITEMS.map((item) => {
          const Icon = iconFor(item.icon)
          const active = item.path === '/' ? route.path === '/' : route.path.startsWith(item.path)
          return (
            <button
              key={item.id}
              type="button"
              title={collapsed ? `${item.label} — ${item.hint}` : item.hint}
              onClick={() => {
                navigate(item.path)
                onNavigate?.()
              }}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-200 focus-ring',
                active ? 'text-ink' : 'text-ink-soft hover:text-ink',
                collapsed && 'justify-center px-2',
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-2xl border border-white/55 bg-gradient-to-r from-white/75 to-white/45 shadow-sm dark:border-white/15 dark:from-white/15 dark:to-white/5"
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-xl transition',
                    active
                      ? 'aurora-surface text-white shadow-lift'
                      : 'bg-white/45 text-ink-soft group-hover:bg-white/70 dark:bg-white/10',
                  )}
                >
                  <Icon size={17} />
                </span>
                {!collapsed && <span className="text-[13.5px] font-medium">{item.label}</span>}
              </span>
            </button>
          )
        })}
      </nav>

      <div className={cn('border-t border-white/30 px-2 py-3 dark:border-white/10')}>
        {collapsed && (
          <div className="mb-2 flex justify-center">
            <IconButton label="Expand sidebar" onClick={onToggleCollapse} size="sm">
              <ChevronsRight size={16} />
            </IconButton>
          </div>
        )}
        <div
          className={cn(
            'glass-subtle rounded-2xl p-2.5',
            collapsed ? 'flex flex-col items-center gap-2' : 'space-y-2.5',
          )}
        >
          <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full aurora-surface text-[12.5px] font-semibold text-white shadow-lift">
              {initials || 'CA'}
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-ink">{profileName}</div>
                <div className="text-[11.5px] capitalize text-ink-muted">
                  {units?.plan ?? 'free'} plan · {units?.cycle ?? 'monthly'}
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <div>
              <div className="flex items-center justify-between text-[11.5px] text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  <Zap size={12} className="text-[color:var(--aurora-blue)]" />
                  AI units
                </span>
                <span className="tabular-nums">
                  {units?.remaining ?? '–'} / {units?.granted ?? '–'}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-400/30 dark:bg-slate-600/50">
                <motion.div
                  className="h-full rounded-full aurora-surface"
                  initial={false}
                  animate={{ width: `${Math.max(2, unitPercent)}%` }}
                  transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  navigate('/settings?tab=plan')
                  onNavigate?.()
                }}
                className="mt-2 w-full rounded-xl border border-white/50 bg-white/55 py-1 text-[12px] font-medium text-ink-soft transition hover:bg-white/75 focus-ring dark:border-white/15 dark:bg-white/10 dark:text-slate-200"
              >
                Manage plan
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
